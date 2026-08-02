# Part 4 — Backend Foundations

With the pure calculation engine done, the next layer is everything the API needs before a single payroll-domain endpoint can be written safely: configuration, authentication, tenant isolation, and RBAC. Get these four right first — every module built in Parts 5–9 leans on all of them.

## 4.1 Environment Validation — Fail Fast, Not Silently Wrong

The single worst failure mode for a multi-tenant SaaS handling PII and money is booting successfully with broken configuration — a missing encryption key, or a JWT secret still set to the checked-in dev default. `env.validation.ts` is wired into `ConfigModule.forRoot({ validate })`, so it runs before any module (and its DB/Redis connections) initializes:

```typescript
// config/env.validation.ts
const INSECURE_DEFAULT_SECRETS = new Set([
  'dev-access-secret-change-me', 'dev-refresh-secret-change-me',
]);
const MIN_SECRET_LENGTH = 16;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.map(...).join('\n')}`);
  }

  if ((validated.NODE_ENV ?? 'development') === 'production') {
    const problems: string[] = [];
    for (const [key, value] of [
      ['JWT_ACCESS_SECRET', validated.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', validated.JWT_REFRESH_SECRET],
    ] as const) {
      if (!value) problems.push(`${key} must be set in production`);
      else if (INSECURE_DEFAULT_SECRETS.has(value)) problems.push(`${key} is still the checked-in dev default`);
      else if (value.length < MIN_SECRET_LENGTH) problems.push(`${key} is too short`);
    }
    if (!validated.ENCRYPTION_KEY) {
      problems.push('ENCRYPTION_KEY must be set in production');
    }
    if (problems.length > 0) {
      throw new Error(`Refusing to start in production with insecure configuration:\n- ${problems.join('\n- ')}`);
    }
  }
  return config;
}
```

The key design choice: **dev-mode defaults are allowed to exist** (so a fresh clone runs with zero setup) **but production checks for exactly those known-insecure values by name** and refuses to boot rather than silently running with a secret anyone who has read the source code can reconstruct.

## 4.2 Bootstrap — `main.ts`

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Needed to verify the Paystack webhook signature, which is computed
    // over the exact raw request bytes rather than the re-serialized body.
    rawBody: true,
  });
  app.useLogger(app.get(Logger));
  app.use(helmet());

  const configService = app.get(ConfigService<AppConfig, true>);
  const sentryDsn = configService.get('sentryDsn', { infer: true });
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: configService.get('nodeEnv', { infer: true }), tracesSampleRate: 0.1 });
  }

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: configService.get('corsOrigin', { infer: true }), credentials: true });

  await app.listen(configService.get('port', { infer: true }));
}
```

`rawBody: true` is not boilerplate — it exists specifically so the Paystack webhook handler (Part 7) can verify a signature computed over the exact bytes Paystack sent, which re-serializing a parsed JSON body would silently break. `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` means every DTO is the actual security boundary for request bodies: unknown fields are stripped, and if a client tries to smuggle a field the DTO doesn't declare, the pipe rejects the whole request rather than quietly dropping it.

## 4.3 `AppModule` — Wiring Order Matters

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    LoggerModule.forRootAsync({ /* pino, redacts Authorization header + password fields */ }),
    ThrottlerModule.forRootAsync({ /* rate limiting */ }),
    CacheModule.registerAsync({ isGlobal: true, /* Redis-backed */ }),
    BullModule.forRootAsync({ /* Redis connection for queues */ }),
    TerminusModule, PrismaModule, AuditModule,
    AuthModule, TenantsModule, EmployeesModule, PayrollModule, PayrollCalculatorModule,
    PayslipsModule, BillingModule, BankExportModule, BrandingModule, HealthModule, CryptoModule,
    ComplianceReportsModule, NotificationsModule, ApiKeysModule, PublicApiModule, WebhooksModule,
    AccountingModule, SalaryComponentsModule, DocumentsModule, LeaveModule, HolidaysModule,
    AttendanceModule, AnalyticsModule, LoansModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
  ],
})
export class AppModule {}
```

Both guard and interceptor **order is significant**. `APP_GUARD` providers run in registration order: `JwtAuthGuard` first (populates `request.user`), then `RolesGuard` and `PermissionsGuard` (both read `request.user`), then `ThrottlerGuard`. `APP_INTERCEPTOR`s run in order too: `TenantContextInterceptor` must run before `AuditInterceptor`, because the audit interceptor's writes need the tenant context already established to be scoped correctly by the Prisma extension (§4.6).

Pino redacts `Authorization`, `password`, `adminPassword`, and the two JWT response fields from every log line — a structured logger is only safe by default if you actively tell it what never to print.

## 4.4 Authentication — JWT Access + Refresh

Passwords are hashed with bcrypt at 12 salt rounds. Both tokens are signed with separate secrets, and the refresh token itself is never stored in plaintext — only its bcrypt hash, on the `User` row:

```typescript
// auth/auth.service.ts
const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.adminPassword, SALT_ROUNDS);
    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          countryCode: dto.countryCode,
          // Derives currency from the country's own pricing catalog rather
          // than defaulting every tenant to KES regardless of country.
          defaultCurrency: getPricingForCountry(dto.countryCode).currency,
        },
      });
      const user = await tx.user.create({
        data: { tenantId: tenant.id, email: dto.adminEmail, passwordHash, role: Role.ADMIN },
      });
      return { tenant, user };
    });

    const tokens = await this.issueTokens(user);
    return { tenant, user: this.toAuthenticatedUser(user), ...tokens };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshTokenHash) throw new UnauthorizedException('Session expired, please log in again');

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      // Reuse of a rotated-out refresh token — revoke the session outright.
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { user: this.toAuthenticatedUser(user), ...(await this.issueTokens(user)) };
  }

  private async issueTokens(user: User) {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    const accessPayload: JwtAccessPayload = {
      sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId, employeeId: user.employeeId,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: jwtConfig.accessSecret, expiresIn: jwtConfig.accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync({ sub: user.id }, {
      secret: jwtConfig.refreshSecret, expiresIn: jwtConfig.refreshExpiresIn,
    });
    // Only the HASH of the refresh token is persisted — never the raw token.
    await this.prisma.user.update({
      where: { id: user.id }, data: { refreshTokenHash: await bcrypt.hash(refreshToken, SALT_ROUNDS) },
    });
    return { accessToken, refreshToken };
  }
}
```

Every field the rest of the system needs to authorize a request — `role`, `tenantId`, `employeeId` — is embedded directly in the access token payload, so authorization never requires a database round-trip on every request. The tradeoff is that a role change doesn't take effect until the user's token expires or they log in again; that's an accepted tradeoff for a 15-minute access token lifetime.

**Reuse detection**: if `refresh()` is called with a refresh token that doesn't match the currently-stored hash — meaning an older, already-rotated-out token is being replayed — the session is revoked outright (`refreshTokenHash: null`) rather than just rejected, on the theory that a mismatched refresh token is a signal the token may have leaked.

`JwtAccessStrategy` (Passport) extracts the bearer token, verifies it against the access secret, and maps the payload onto `AuthenticatedRequestUser`:

```typescript
// auth/strategies/jwt-access.strategy.ts
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).accessSecret,
    });
  }
  validate(payload: JwtAccessPayload): AuthenticatedRequestUser {
    return { id: payload.sub, email: payload.email, role: payload.role, tenantId: payload.tenantId, employeeId: payload.employeeId };
  }
}
```

## 4.5 Dual-Guard RBAC — Roles + Fine-Grained Permissions

Authorization runs as two independent global guards that both must pass — they are not alternatives to each other.

**`RolesGuard`** checks the coarse `@Roles(Role.ADMIN, Role.HR)` decorator against `request.user.role`:

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    // API-key-authenticated requests carry a placeholder role that must
    // never be allowed to satisfy a real role check — fail closed.
    if (request.isApiKeyAuth) {
      throw new ForbiddenException('API-key authentication is not permitted on role-restricted routes');
    }
    const user: AuthenticatedRequestUser | undefined = request.user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}
```

**`PermissionsGuard`** checks the fine-grained `@RequirePermission(Permission.PAYROLL_RUN)` decorator against a role→permission map:

```typescript
// common/permissions/permission.enum.ts
export enum Permission {
  EMPLOYEE_WRITE = 'employee:write', EMPLOYEE_TERMINATE = 'employee:terminate',
  PAYROLL_RUN = 'payroll:run', PAYROLL_CORRECT = 'payroll:correct', PAYROLL_READ = 'payroll:read',
  LEAVE_APPROVE = 'leave:approve', LEAVE_TYPE_MANAGE = 'leave-type:manage',
  DOCUMENT_DELETE = 'document:delete', BILLING_MANAGE = 'billing:manage', REPORTS_READ = 'reports:read',
  API_KEY_MANAGE = 'apikey:manage', WEBHOOK_MANAGE = 'webhook:manage', TENANT_MANAGE = 'tenant:manage',
  BRANDING_MANAGE = 'branding:manage', ATTENDANCE_MANAGE = 'attendance:manage',
  LOAN_MANAGE = 'loan:manage', SALARY_COMPONENT_MANAGE = 'salary-component:manage',
}

// common/permissions/role-permissions.map.ts
const ADMIN_ONLY_PERMISSIONS: Permission[] = [
  Permission.BILLING_MANAGE, Permission.API_KEY_MANAGE, Permission.WEBHOOK_MANAGE,
  Permission.TENANT_MANAGE, Permission.EMPLOYEE_TERMINATE, Permission.BRANDING_MANAGE,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.HR]: Object.values(Permission).filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p)),
  [Role.EMPLOYEE]: [],
};
```

Both guards are applied together on every write-sensitive controller (e.g. `@Roles(Role.ADMIN, Role.HR)` + `@RequirePermission(Permission.PAYROLL_RUN)` on the run-payroll endpoint) — currently the permission map is entirely role-derived, so the two checks are redundant in practice today. That redundancy is deliberate: consolidating onto one declared-permission model per endpoint is what lets access control evolve later (e.g. a custom per-tenant role) without having to touch every controller's role list.

Both guards share a critical fail-closed check: an API-key-authenticated request (Part 9's public read-only API) carries a placeholder role that must never satisfy a role or permission check meant for real human users — so both guards explicitly reject `request.isApiKeyAuth` rather than letting the placeholder accidentally pass.

## 4.6 Structural Multi-Tenancy

This is the piece that makes tenant isolation a property of the system rather than a discipline every developer has to remember. It has two halves: request-scoped context, and a Prisma extension that reads it.

**Half 1 — `AsyncLocalStorage`-backed context**, set once per request and readable anywhere in that request's async call chain without threading `tenantId` through every function signature:

```typescript
// common/tenant/tenant-context.ts
const storage = new AsyncLocalStorage<TenantContextStore>();

export const TenantContext = {
  run<T>(store: TenantContextStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  getTenantId(): string | undefined {
    return storage.getStore()?.tenantId;
  },
};
```

`TenantContextInterceptor` establishes it, with one subtlety worth calling out explicitly because it's easy to get wrong: `next.handle()` returns a *cold* Observable — nothing runs until something subscribes — and that subscription normally happens inside Nest's own pipeline, by which point a naive synchronous `TenantContext.run(...)` would already have returned and torn the context down before the controller even executes. The fix is to subscribe to `next.handle()` yourself, synchronously, *inside* the `run` callback:

```typescript
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.user?.tenantId;
    if (!tenantId) return next.handle();

    return new Observable((subscriber) => {
      TenantContext.run({ tenantId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
```

**Half 2 — a Prisma client extension** that intercepts every query against a defined set of tenant-scoped models and rewrites its `where`/`data` to enforce the tenant boundary, transparently to the calling service code:

```typescript
// prisma/tenant-scoping.extension.ts
// Models with a direct tenantId column. Models reached only through a
// relation (Employee -> Company -> Tenant) aren't listed — Prisma can't
// generically inject a nested join filter for those; those rely on explicit
// company.tenantId ownership checks in each service instead.
export const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
  'BrandingConfig', 'Company', 'User', 'SalaryComponent', 'LeaveType',
  'AuditLog', 'Subscription', 'Invoice', 'UsageRecord', 'Notification',
  'ApiKey', 'WebhookEndpoint', 'Loan',
]);

export function scopeQueryArgs(operation: string, args: Record<string, unknown>, tenantId: string) {
  const scoped = { ...args } as { where?: Record<string, unknown>; data?: unknown };

  if (READ_OPS.has(operation) || WHERE_SCOPED_WRITE_OPS.has(operation)) {
    scoped.where = { ...(scoped.where ?? {}), tenantId };
  }
  if (operation === 'create') {
    assertNotCrossTenant(scoped.data, tenantId); // reject a spoofed tenantId in the payload outright
    scoped.data = { ...(scoped.data as object), tenantId };
  }
  // ...createMany, update, upsert handled the same way
  return scoped;
}

export const tenantScopingExtension = Prisma.defineExtension({
  name: 'tenant-scoping',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_SCOPED_MODELS.has(model)) return query(args);
        const tenantId = TenantContext.getTenantId();
        if (!tenantId) return query(args); // no context = cron/seed/signup path, deliberately unenforced
        return query(scopeQueryArgs(operation, args as Record<string, unknown>, tenantId) as typeof args);
      },
    },
  },
});
```

`scopeQueryArgs` is deliberately a **pure function** separate from the `$extends` wiring, for the same reason the payroll engine is pure: it can be unit-tested exhaustively (every operation type, every cross-tenant-spoofing attempt) with zero database.

The result: a developer writing `this.prisma.company.findMany({ where: { name: 'Acme' } })` inside an authenticated request gets `tenantId` injected automatically — even if they forgot to add it themselves. Attempting `this.prisma.company.create({ data: { tenantId: 'someone-elses-tenant', ... } })` throws `ForbiddenException` rather than silently overwriting it. Outside a request (cron jobs, queue processors, the signup flow creating the very first `Tenant`/`Company`/`User`), `TenantContext` is unset and the extension is a no-op — those paths legitimately need to operate before or without a tenant context.

Models reached only through a relation (`Employee → Company → Tenant`) aren't in `TENANT_SCOPED_MODELS` because Prisma can't generically inject a nested-join filter for an arbitrary relation depth — those services instead do an explicit ownership check, e.g. `assertCompanyBelongsToTenant(companyId, tenantId)`, before touching the child rows.

## 4.7 Field-Level Encryption

Sensitive PII — KRA PIN, NSSF/NHIF numbers, bank account numbers — is encrypted at rest with AES-256-GCM, via explicit `encrypt()`/`decrypt()` calls in the owning service (not a transparent Prisma middleware, matching the fact this codebase has no other implicit `$use` hook):

```typescript
// common/crypto/encryption.service.ts
const ALGORITHM = 'aes-256-gcm';
const DEV_FALLBACK_KEY = '0'.repeat(64); // 32 zero bytes, hex — dev only

@Injectable()
export class EncryptionService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const configuredKey = this.configService.get('encryptionKey', { infer: true });
    const nodeEnv = this.configService.get('nodeEnv', { infer: true });
    // Fail closed: never silently encrypt production PII with a well-known key.
    if (!configuredKey && nodeEnv === 'production') {
      throw new Error('ENCRYPTION_KEY is not set. Refusing to start in production without a real encryption key.');
    }
    this.key = Buffer.from(configuredKey || DEV_FALLBACK_KEY, 'hex');
  }

  encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  decrypt(ciphertext: string | null | undefined): string | null {
    if (!ciphertext) return null;
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(ivHex!, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex!, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex!, 'hex')), decipher.final()]).toString('utf8');
  }
}
```

Ciphertext is stored as `iv:authTag:ciphertext`, all hex-encoded, in a single string column — GCM's auth tag means a tampered ciphertext fails to decrypt rather than silently returning corrupted plaintext.

## 4.8 Audit Logging

`AuditInterceptor` (registered globally, running *after* `TenantContextInterceptor` — see §4.3) writes an `AuditLog` row for mutating requests, capturing `actorId`, `action`, `entityType`/`entityId`, and `before`/`after` snapshots where applicable. Because it runs inside the same tenant context established by the interceptor ahead of it, its own writes go through the same `tenantScopingExtension` as everything else — an audit log entry is automatically stamped with the correct `tenantId` with no special-casing.

With authentication, tenant isolation, RBAC, encryption, and auditing all in place, Part 5 builds the actual payroll domain API on top of this foundation.
