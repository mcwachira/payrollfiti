# Part 18 — Accounting Sync & the In-App Notification Center

Two features that shipped earlier in this build never made it into the guide: the frontend half of the notification system Part 8 built the backend for, and a full accounting-sync integration — QuickBooks, Xero, and Zoho Books — that Part 7 only ever mentioned in passing. Both are real, wired-up features already running in the app; this part is where they were missing from, not where they were built.

## 18.1 The Notification Bell — Reading What Part 8 Writes

Part 8 covered `NotificationsService.create`/`dispatch` writing rows and fanning out to email/SMS/push, but never the controller a logged-in user actually calls to read their own notifications:

```typescript
// notifications/notifications.controller.ts
/** No @Roles() gating — any authenticated user manages only their own notifications. */
@Controller('notifications')
export class NotificationsController {
  @Get()
  findMine(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listForUser(tenantId, user.id, unreadOnly === 'true');
  }

  @Patch(':id/read')
  markRead(@CurrentTenant() tenantId: string, @CurrentUser() user: AuthenticatedRequestUser, @Param('id') id: string) {
    return this.notificationsService.markRead(tenantId, user.id, id);
  }

  @Post('read-all')
  markAllRead(@CurrentTenant() tenantId: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.notificationsService.markAllRead(tenantId, user.id);
  }
}
```

Every method here is implicitly scoped to the caller — `listForUser`/`markRead`/`markAllRead` all filter by `userId` server-side, so there's no `@Roles()` guard needed: a regular `EMPLOYEE` and an `ADMIN` hit the exact same three endpoints, each only ever seeing their own rows.

The frontend used to just show an unread count; `NotificationBell` replaces that with a real popover, and deliberately fetches two different things at two different times:

```typescript
// components/NotificationBell.tsx
const unreadQuery = useQuery({
  queryKey: ['notifications', 'unread'],
  queryFn: () => listNotifications(true),
});
const unreadCount = unreadQuery.data?.length ?? 0;

// Only fetched once the popover is actually opened — the header renders on
// every page, so the full (read + unread) list shouldn't be a standing
// request alongside the lightweight unread-count poll above.
const listQuery = useQuery({
  queryKey: ['notifications', 'all'],
  queryFn: () => listNotifications(false),
  enabled: open,
});
```

The unread count query is cheap and always live (it's what the little red badge on the bell icon reflects, everywhere in the app); the full list — potentially many rows, with relative timestamps — only fires when the popover actually opens. Clicking an unread row marks it read and invalidates both queries in one shot, rather than optimistically mutating local state and risking it drifting from the server:

```typescript
// components/NotificationBell.tsx
const markReadMutation = useMutation({
  mutationFn: markNotificationRead,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  },
});
```

Mounted once in `AppHeader`, next to the theme toggle and the push-notification bell from Part 14 — every authenticated user gets the same bell regardless of role, same as the rest of the header.

## 18.2 Accounting Integrations — the OAuth Dance

Part 7 mentioned in one sentence that "webhook dispatch and accounting sync are best-effort" after a payment settles, without ever showing what actually powers that sync. `AccountingProvider` (Part 4's extension-point pattern again — an interface plus a swappable implementation) originally shipped as a stub with no real credentials to test against; it's since grown into a full three-platform OAuth2 integration.

```prisma
// prisma/schema.prisma
model AccountingIntegration {
  id                    String                 @id @default(uuid())
  tenantId              String                 @unique
  tenant                Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  provider              AccountingProviderType
  externalId            String
  accessTokenEncrypted  String
  refreshTokenEncrypted String
  expiresAt             DateTime
  connectedById         String?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt
}
```

One row per tenant (`tenantId @unique`) — connecting a second platform replaces the first rather than running two in parallel, which matches the UI (§18.4) offering one "Connect" action per platform, mutually exclusive in practice. Both OAuth tokens go through `EncryptionService` (Part 4 §4.7), the same field-level AES-256-GCM encryption used for KRA PINs and bank account numbers — these are live credentials to a tenant's real accounting system, not something to leave in plaintext.

Starting a connection needs somewhere to send the tenant back to once the OAuth consent screen redirects. Rather than a database row to track "this authorization attempt is legitimate," it reuses the same purpose-tagged-JWT pattern as the 2FA login challenge (Part 16 §16.2) — a `state` param that's just a short-lived, signed token:

```typescript
// accounting/accounting-integrations.service.ts
const STATE_PURPOSE = 'accounting-oauth-state';

async getAuthorizeUrl(tenantId: string, userId: string, provider: AccountingProviderType): Promise<string> {
  const client = this.registry.get(provider);
  if (!client.isConfigured()) {
    throw new BadRequestException(`${provider} is not configured on this server — set its CLIENT_ID/CLIENT_SECRET env vars first`);
  }

  const state = await this.jwtService.signAsync(
    { purpose: STATE_PURPOSE, tenantId, userId, provider } satisfies OAuthStatePayload,
    { secret: this.configService.get('jwt', { infer: true }).accessSecret, expiresIn: '10m' },
  );
  return client.getAuthorizeUrl(state);
}
```

The callback is necessarily `@Public()` — the platform redirects the user's browser straight back with no `Authorization` header, since it's a plain navigation rather than an XHR call from the app's own frontend. The signed `state` is what proves the callback belongs to a real, recent, still-valid authorization attempt instead:

```typescript
// accounting/accounting-integrations.controller.ts
// Public: this is where QuickBooks/Xero/Zoho Books redirect the user's
// BROWSER back to after they approve access — no Authorization header is
// present, since it's a plain navigation, not an XHR call from our own
// frontend. The signed `state` param (see getAuthorizeUrl) is what proves
// the request is legitimate instead.
@Public()
@Get('callback/:provider')
@Redirect()
async callback(
  @Param('provider', new ParseEnumPipe(AccountingProviderType)) provider: AccountingProviderType,
  @Query('code') code: string,
  @Query('state') state: string,
  @Query() query: Record<string, string | undefined>,
) {
  try {
    await this.integrationsService.handleCallback(provider, code, state, query);
    return { url: `${corsOrigin}/settings?accounting=connected&provider=${provider}` };
  } catch {
    return { url: `${corsOrigin}/settings?accounting=error&provider=${provider}` };
  }
}
```

```typescript
// accounting/accounting-integrations.service.ts
async handleCallback(provider: AccountingProviderType, code: string, state: string, callbackParams: Record<string, string | undefined>): Promise<void> {
  const payload = await this.jwtService.verifyAsync<OAuthStatePayload>(state, {
    secret: this.configService.get('jwt', { infer: true }).accessSecret,
  }); // throws -> caught by the controller's try/catch, redirects to ?accounting=error

  // `provider` is the URL path param the platform redirected to; cross-check
  // against the provider embedded in `state` so a tampered path segment
  // can't attach the wrong provider's tokens to this connection.
  if (payload.purpose !== STATE_PURPOSE || payload.provider !== provider) {
    throw new UnauthorizedException('This authorization link is invalid or has expired');
  }

  const client = this.registry.get(provider);
  const tokens = await client.exchangeCodeForTokens(code, callbackParams);

  await this.prisma.accountingIntegration.upsert({
    where: { tenantId: payload.tenantId },
    create: { tenantId: payload.tenantId, provider, externalId: tokens.externalId,
      accessTokenEncrypted: this.encryptionService.encrypt(tokens.accessToken)!,
      refreshTokenEncrypted: this.encryptionService.encrypt(tokens.refreshToken)!,
      expiresAt: tokens.expiresAt, connectedById: payload.userId },
    update: { /* same shape */ },
  });
}
```

## 18.3 Three Platforms, One Interface

`AccountingPlatformClientRegistry` is a single lookup table — `AccountingProviderType -> client` — shared by both the OAuth-flow service above and the sync-time router below, so neither duplicates the provider list:

```typescript
// accounting/accounting-platform-client-registry.service.ts
@Injectable()
export class AccountingPlatformClientRegistry {
  private readonly clients: Record<AccountingProviderType, AccountingPlatformClient>;

  constructor(quickbooks: QuickBooksAccountingProvider, xero: XeroAccountingProvider, zohoBooks: ZohoBooksAccountingProvider) {
    this.clients = {
      [AccountingProviderType.QUICKBOOKS]: quickbooks,
      [AccountingProviderType.XERO]: xero,
      [AccountingProviderType.ZOHO_BOOKS]: zohoBooks,
    };
  }

  get(provider: AccountingProviderType) { return this.clients[provider]; }
  all() { return Object.values(this.clients); }
}
```

Each platform client implements the same `AccountingPlatformClient` shape — `isConfigured`, `getAuthorizeUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `syncInvoice`, `syncPayrollExpense` — against genuinely different real APIs. QuickBooks Online is representative of the shape all three take:

```typescript
// accounting/providers/quickbooks-accounting.provider.ts
/**
 * QuickBooks Online, via Intuit's OAuth2 + REST API (v3). Both syncInvoice
 * and syncPayrollExpense post a balanced JournalEntry rather than a Sales
 * Invoice/Bill — a journal entry is the one QBO transaction type that
 * doesn't require a pre-existing Customer/Vendor/Item master record on the
 * tenant's side, which this integration has no way to know or create
 * correctly. Accounts referenced by name are looked up, or created on
 * first use, via the Account query/create endpoints.
 */
@Injectable()
export class QuickBooksAccountingProvider implements AccountingPlatformClient {
  syncPayrollExpense(credentials: ResolvedAccountingCredentials, run: { totals: unknown }) {
    const totals = parsePayrollTotals(run.totals);
    return this.postJournalEntry(credentials, [
      { accountName: 'Payroll Expense', accountType: 'Expense', debit: totals.grossPay, credit: 0 },
      { accountName: 'Payroll Liabilities', accountType: 'Other Current Liability', debit: 0, credit: totals.totalDeductions },
      { accountName: 'Bank', accountType: 'Bank', debit: 0, credit: totals.netPay },
    ]);
  }
}
```

That's the actual double-entry shape of a payroll run landing in a real ledger: gross pay debited to an expense account, statutory/other deductions credited to a liabilities account (money the company now owes elsewhere — tax authorities, pension funds), and net pay credited straight out of the bank account. `resolveAccount` looks each named account up by name via QuickBooks' query API and creates it on first use if it doesn't exist yet, so a brand-new QuickBooks company file doesn't need any manual chart-of-accounts setup before the first sync succeeds.

Access tokens expire; `AccountingProviderRouter` is what everything else in the codebase actually calls, and it owns refreshing a token proactively — ahead of its recorded expiry, not reactively after a sync call fails against an already-expired one:

```typescript
// accounting/accounting-provider-router.ts
const REFRESH_SKEW_MS = 2 * 60 * 1000;

/**
 * The single AccountingProvider bound to ACCOUNTING_PROVIDER — everything
 * BillingService/PayrollService already call is unchanged; this router is
 * what makes "one global provider" become "whichever provider this tenant
 * connected, using their own OAuth tokens", entirely behind the same
 * interface a no-op provider used to satisfy.
 */
@Injectable()
export class AccountingProviderRouter implements AccountingProvider {
  private async resolveCredentials(tenantId: string) {
    const integration = await this.prisma.accountingIntegration.findUnique({ where: { tenantId } });
    if (!integration) return null;

    if (integration.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
      return { client: this.registry.get(integration.provider), credentials: { /* decrypted access token */ } };
    }

    const refreshed = await client.refreshAccessToken(refreshToken);
    await this.prisma.accountingIntegration.update({ where: { tenantId }, data: { /* re-encrypted, new expiresAt */ } });
    return { client, credentials: { accessToken: refreshed.accessToken, externalId: integration.externalId } };
  }
}
```

If a tenant has no integration connected at all, `resolveCredentials` returns `null` and the router responds with `{ success: false, error: 'No accounting integration connected for this tenant' }` rather than throwing — matching `AccountingSyncResult`'s shape everywhere else, and letting the two call sites below stay simple, best-effort `.catch(() => {})` calls with no special-casing for "not connected yet" as an error condition.

## 18.4 Wired Into Billing and Payroll

Two call sites, both already-existing code from Part 5 and Part 7 that needed zero changes when the router replaced the original stub — the whole point of the extension-point pattern:

```typescript
// billing/billing.service.ts — after a subscription invoice is marked paid
await this.accountingProvider.syncInvoice({
  id: invoice.id, tenantId, amount: invoice.amount, currency: invoice.currency, status: InvoiceStatus.PAID,
}).catch(() => {});
```

```typescript
// payroll/payroll.service.ts — after a payroll run completes
await this.accountingProvider.syncPayrollExpense({
  id: run.id, tenantId, companyId: run.companyId, period: run.period, totals,
}).catch(() => {});
```

`GET /accounting/integrations` (`@Roles(ADMIN)`) reports, per platform, whether it's `configured` (this server has `CLIENT_ID`/`CLIENT_SECRET` set for it at all) and `connected` (this specific tenant has authorized it) — two independent booleans, since a platform can be configured server-wide but not yet connected by this tenant, or in principle configured differently across environments. `AccountingIntegrationsSettings` renders that as one row per platform on the Settings page:

```typescript
// components/settings/AccountingIntegrationsSettings.tsx
const connectMutation = useMutation({
  mutationFn: getAccountingConnectUrl,
  onSuccess: (authorizeUrl) => {
    // Full-page navigation, not a popup — this is a standard OAuth consent
    // redirect, and the platform's own callback lands the browser back on
    // /settings when it's done.
    window.location.href = authorizeUrl;
  },
});
```

`disabled={!status.configured}` on the "Connect" button means an unconfigured platform's row still renders — so an `ADMIN` can see QuickBooks/Xero/Zoho Books all exist as options — but can't be clicked into a dead OAuth flow that would fail server-side anyway.

End to end: an `ADMIN` clicks "Connect" next to QuickBooks on `/settings`, gets redirected to Intuit's real consent screen, approves access, lands back on `/settings?accounting=connected&provider=QUICKBOOKS`, and from that point on, every subscription payment and every completed payroll run posts a real balanced journal entry into that tenant's actual QuickBooks company file — no polling, no manual export, and no code in `BillingService` or `PayrollService` that had to know which of three platforms, or none, a given tenant uses.
