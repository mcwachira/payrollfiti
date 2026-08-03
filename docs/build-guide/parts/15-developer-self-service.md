# Part 15 — Developer Self-Service: API Keys, Webhooks & the Audit Log

Everything so far has been for the people using the app directly. This part is for the systems around it: a script that needs read-only API access, an external tool that wants to know the moment a payroll run completes, and — cutting across both — the question an `ADMIN` eventually asks: *who did that, and when?* All three ship together because the third one caught a real bug in how the other two were being logged.

## 15.1 API Keys — Machine Credentials for the Public API

`GET /public-api/v1/*` (Part 9) needed a way to authenticate that isn't "log in as a human." An `ApiKey` is a long-lived, revocable credential scoped to a tenant, generated and shown exactly once:

```prisma
// prisma/schema.prisma
model ApiKey {
  id          String    @id @default(uuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  hashedKey   String    @unique
  keyPrefix   String
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdById String?
  createdBy   User?     @relation(fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())

  @@index([tenantId])
}
```

```typescript
// api-keys/api-keys.service.ts
/**
 * Hashing choice: SHA-256, NOT bcrypt. API keys are high-entropy
 * machine-generated tokens (32 random bytes) rather than low-entropy
 * user-chosen passwords, so there is no dictionary/brute-force risk that
 * bcrypt's deliberate slowness defends against here — a fast one-way hash
 * is sufficient and avoids needless per-request CPU overhead on every
 * public-api call.
 */
async create(tenantId: string, actorId: string, dto: CreateApiKeyDto) {
  const rawKey = `pfk_${randomBytes(24).toString('hex')}`;
  const hashedKey = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12);

  const apiKey = await this.prisma.apiKey.create({
    data: { tenantId, name: dto.name, hashedKey, keyPrefix, createdById: actorId },
  });

  // rawKey is returned ONLY in this response — it is never retrievable
  // again after this call (only its SHA-256 hash is persisted).
  return { apiKey, rawKey };
}
```

`list()` explicitly `select`s every column except `hashedKey` rather than relying on the frontend to not render a field it was handed — the row simply isn't fetched, so there's no raw-or-hashed key material to leak even if the response were logged somewhere unexpected. (Foreshadowing §15.3.) Validation is the same SHA-256 lookup in reverse, plus a `lastUsedAt` bump on every hit:

```typescript
// common/guards/api-key.guard.ts
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const key = request.headers['x-api-key'];
  if (!key || typeof key !== 'string') {
    throw new UnauthorizedException('Missing X-API-Key header');
  }

  const tenantContext = await this.apiKeysService.validate(key);
  if (!tenantContext) {
    throw new UnauthorizedException('Invalid or revoked API key');
  }

  // Shaped exactly like AuthenticatedRequestUser so the existing
  // @CurrentTenant()/@CurrentUser() decorators work unmodified on
  // public-api routes. `role` here is a placeholder only — it must never
  // be relied on to grant access. `isApiKeyAuth` lets RolesGuard/
  // PermissionsGuard fail closed if a role/permission check is ever added
  // to a public-api route, instead of this placeholder silently
  // satisfying it.
  request.user = { id: 'api-key', email: '', role: Role.ADMIN, tenantId: tenantContext.tenantId, employeeId: null };
  request.isApiKeyAuth = true;
  return true;
}
```

The frontend's `ApiKeysSettings` panel holds the freshly-created `rawKey` only in local component state, never in the React Query cache — a page refresh loses it permanently, same as the server does:

```typescript
// components/settings/ApiKeysSettings.tsx
const [revealedKey, setRevealedKey] = useState<string | null>(null);

const createMutation = useMutation({
  mutationFn: createApiKey,
  onSuccess: ({ rawKey }) => {
    setRevealedKey(rawKey);          // shown once, in a dismissible amber banner
    queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  },
});
```

## 15.2 Webhooks — Outbound Event Delivery

Where an API key is a credential presented *to* the server, a webhook secret is one the server holds and uses to *sign* outgoing requests — closer to how Stripe or GitHub sign their webhook payloads than to a password. That distinction drives the storage choice directly: it's stored retrievable (not hashed), because every dispatch needs to compute an HMAC with it.

```prisma
// prisma/schema.prisma
model WebhookEndpoint {
  id         String               @id @default(uuid())
  tenantId   String
  tenant     Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  url        String
  secret     String
  events     String[]
  isActive   Boolean              @default(true)
  deliveries WebhookDeliveryLog[]
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt

  @@index([tenantId])
}
```

```typescript
// webhooks/webhooks.service.ts
async create(tenantId: string, dto: CreateWebhookDto) {
  await assertPublicWebhookUrl(dto.url);
  const secret = randomBytes(32).toString('hex');
  // This create() response is the ONLY place the full, unmasked secret is
  // ever returned again — list() below masks it.
  return this.prisma.webhookEndpoint.create({
    data: { tenantId, url: dto.url, events: dto.events, secret },
  });
}

async list(tenantId: string) {
  const endpoints = await this.prisma.webhookEndpoint.findMany({ where: { tenantId } });
  return endpoints.map((endpoint) => ({ ...endpoint, secret: `whsec_...${endpoint.secret.slice(-4)}` }));
}
```

`assertPublicWebhookUrl` (Part 9's SSRF guard) runs twice — once at create/update time, and again at dispatch time, right before the actual request:

```typescript
// webhooks/webhooks.service.ts
private async deliverOne(endpoint: WebhookEndpoint, event: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', endpoint.secret).update(body).digest('hex');

  try {
    // Re-check at dispatch time, not just at create/update — narrows the
    // window for DNS-rebinding (endpoint.url resolving to a private
    // address only after it passed the create-time check).
    await assertPublicWebhookUrl(endpoint.url);
    const response = await axios.post(endpoint.url, payload, {
      headers: { 'X-Webhook-Signature': signature, 'X-Webhook-Event': event },
      timeout: DELIVERY_TIMEOUT_MS,
    });
    // ...records a WebhookDeliveryLog row either way, success or failure
  } catch (err) { /* ... */ }
}
```

Delivery is deliberately best-effort with no retry — a `WebhookDeliveryLog` row records every attempt's outcome (`statusCode`, `success`, `error`), visible via `GET /webhooks/:id/deliveries`, but a failed delivery isn't requeued. That's an explicit, documented gap rather than an oversight: a BullMQ-backed retry queue is the natural next step given Part 17's fan-out pattern is right there to copy, but it's scoped out of this pass.

## 15.3 The Audit Log — and a Real Leak It Caught

`AuditInterceptor` (introduced earlier, Part 4) generically logs every mutating request's response body into `AuditLog.after`. That's convenient — no per-endpoint wiring needed — but building the viewer for it in this pass surfaced exactly why "convenient" and "safe" aren't the same thing: `POST /api-keys` returns `{ apiKey, rawKey }`, and `POST /webhooks` returns the endpoint including its full `secret`. The interceptor was logging both, verbatim, into a table that `ADMIN`s could now browse — silently defeating the "shown once" guarantee both features are built around.

```prisma
// prisma/schema.prisma
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  actorId    String?
  actor      User?    @relation(fields: [actorId], references: [id])
  action     String
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([tenantId, entityType, entityId])
  @@index([tenantId, createdAt])
}
```

The fix goes in one place — `AuditService.record()`, the single choke point every audit write passes through, whether from the generic interceptor or a service's own explicit call — rather than patching each call site and hoping nobody adds a new one that forgets:

```typescript
// audit/redact-sensitive-fields.ts
const SENSITIVE_KEY_PATTERN =
  /password|secret|rawkey|hashedkey|hashedpassword|tokenhash|accesstoken|refreshtoken|^token$/i;

/**
 * Recursively strips values of sensitive-looking keys before they're
 * persisted to AuditLog.before/after. Matches by key name, not by value
 * shape, so it degrades safely (over-redacts) rather than missing a field
 * with an unexpected type.
 */
export function redactSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactSensitiveFields(val);
    }
    return result as T;
  }
  return value;
}
```

```typescript
// audit/audit.service.ts
async record(entry: RecordAuditEntryInput): Promise<void> {
  try {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: redactSensitiveFields(entry.before) ?? Prisma.JsonNull,
        after: redactSensitiveFields(entry.after) ?? Prisma.JsonNull,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    this.logger.error(`Failed to write audit log for ${entry.entityType}:${entry.entityId}`, error as Error);
  }
}
```

Confirmed live before shipping: created an API key and a webhook through the running app, checked the resulting `AuditLog` rows directly via `psql` — both `rawKey` and `secret` showed up in plaintext under the old code, and `[REDACTED]` after the fix. Two pre-fix rows that had already leaked into the persistent demo tenant's database were purged by hand.

The viewer itself is a filtered, paginated table — `GET /audit-logs`, `@Roles(ADMIN)` and gated behind a dedicated `Permission.AUDIT_LOG_READ` (not just the role check, so a future non-`ADMIN` role with elevated permissions still can't read it by accident):

```typescript
// audit/audit.service.ts
async list(tenantId: string, query: ListAuditLogsQueryDto): Promise<PaginatedAuditLogs> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
  };

  const [items, total] = await Promise.all([
    this.prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: { actor: { select: { email: true } } },
    }),
    this.prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, limit };
}
```

`/audit-log` on the frontend is a filterable table (entity type, action substring) with a details dialog that pretty-prints the (now-redacted) `before`/`after` JSON per row — reachable only from an `ADMIN`-only sidebar entry.

Three features, one thread: giving a tenant real self-service — its own API keys, its own outbound webhooks — only pays off if the tenant can also see what happened with them, and that visibility has to be built with the same care as the credentials it's reporting on. Part 16 turns to hardening the login itself.
