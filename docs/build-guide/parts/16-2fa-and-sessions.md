# Part 16 — Two-Factor Authentication & Session Management

Part 13 covered how someone gets a login and how they recover it if lost. This part hardens what happens once they have one: a second factor beyond the password, and — the bigger of the two — proper multi-device sessions in place of a single shared token slot. The second half of that story turned into a real security bug hunt, not just a feature build.

## 16.1 TOTP Setup — Three Calls, Not One

Turning on 2FA is three separate calls rather than one, on purpose: generate a secret, prove the authenticator app actually produces matching codes before trusting it, only then flip the flag.

```prisma
// prisma/schema.prisma — added to User
twoFactorSecretEncrypted String?
twoFactorEnabled         Boolean  @default(false)
twoFactorBackupCodes     String[] @default([])
```

`twoFactorSecretEncrypted` uses the same AES-256-GCM `EncryptionService` already built for KRA PINs and bank account numbers (Part 6) — unlike a token hash, this secret has to be recovered in plaintext on every login to compute the expected code, so it can't be one-way hashed the way everything else in this system's credential story is.

```typescript
// auth/auth.service.ts
async setupTwoFactor(userId: string) {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = await otplib.generateSecret();
  await this.prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecretEncrypted: this.encryptionService.encrypt(secret)! },
  });

  const otpauthUrl = otplib.generateURI({
    strategy: 'totp',
    issuer: this.configService.get('appName', { infer: true }),
    label: user.email,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

async enableTwoFactor(userId: string, dto: TwoFactorEnableDto) {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.twoFactorSecretEncrypted) throw new BadRequestException('Call /auth/2fa/setup first');

  const secret = this.encryptionService.decrypt(user.twoFactorSecretEncrypted)!;
  if (!(await verifyTotpSafely(secret, dto.code))) throw new UnauthorizedException('Invalid code');

  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
  await this.prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: backupCodes.map(hashBackupCode) },
  });
  return { backupCodes }; // shown once, same treatment as an ApiKey's raw value
}
```

Backup codes get the exact same one-way SHA-256 treatment as everything else machine-generated in this schema — `hashBackupCode` normalizes (`WDPA-WR2C` → `WDPAWR2C`, uppercased) before hashing, so formatting quirks in how a user retypes a code don't cause false rejections. `otplib.verify()` turned out to have a sharp edge worth calling out: it *throws* rather than returning `{ valid: false }` for a malformed token, which matters the moment a backup code (`WDPA-WR2C`, nine characters) gets tried where a 6-digit TOTP code was expected — that crashed the real login flow with a raw 500 before a wrapper caught it:

```typescript
// auth/auth.service.ts
async function verifyTotpSafely(secret: string, token: string): Promise<boolean> {
  try {
    const result = await otplib.verify({ secret, token });
    return result.valid;
  } catch {
    return false;
  }
}
```

Every call site that checks a live TOTP code goes through this wrapper, never `otplib.verify` directly — confirmed with a regression test that feeds it a backup-code-shaped string and asserts it falls through to the backup-code check below instead of throwing.

## 16.2 The Login Flow's Second Step

`login()` no longer always returns tokens. If the user has 2FA enabled, it returns a short-lived challenge instead — the same purpose-tagged-JWT pattern already used for the accounting OAuth `state` param (Part 7), reused here as a general "prove this request is legitimate" mechanism rather than something session-specific:

```typescript
// auth/auth.service.ts
async login(dto: LoginDto, meta: SessionMeta = {}) {
  const user = await this.validateUser(dto.email, dto.password);
  if (user.twoFactorEnabled) {
    const challengeToken = await this.jwtService.signAsync(
      { purpose: '2fa-challenge', sub: user.id },
      { secret: this.configService.get('jwt', { infer: true }).accessSecret, expiresIn: '5m' },
    );
    return { twoFactorRequired: true as const, challengeToken };
  }
  const { session, ...tokens } = await this.createSession(user, meta);
  return { user: this.toAuthenticatedUser(user, session.id), ...tokens };
}
```

`verifyTwoFactor()` redeems that challenge into real tokens, checking the `purpose` claim explicitly — a `challengeToken` is just a JWT signed with the same access secret as everything else, so without that check a token minted for an entirely different purpose (say, a future feature reusing the same pattern) could be replayed here:

```typescript
// auth/auth.service.ts
async verifyTwoFactor(dto: TwoFactorVerifyDto, meta: SessionMeta = {}) {
  const payload = await this.jwtService.verifyAsync(dto.challengeToken, {
    secret: this.configService.get('jwt', { infer: true }).accessSecret,
  }); // throws -> caught, turned into a clear "please sign in again"
  if (payload.purpose !== '2fa-challenge') {
    throw new UnauthorizedException('This login attempt has expired — please sign in again');
  }
  // ...verifyTwoFactorCode(user, dto.code), then createSession as normal
}
```

`AuthContext.login()` on the frontend types this as a union — `AuthenticatedUserDto | TwoFactorChallenge` — and the login page branches on which one came back, swapping the password form for a code-entry form without a page navigation:

```typescript
// app/(auth)/login/page.tsx
const result = await login(email, password);
if ('twoFactorRequired' in result) {
  setChallengeToken(result.challengeToken);   // renders the code-entry form
} else {
  redirectByRole(result.role);
}
```

## 16.3 Sessions — Replacing a Single Shared Token Slot

Before this pass, `User` had one `refreshTokenHash String?` field — meaning exactly one active login per user, system-wide. Signing in on a second device didn't add a session; it silently invalidated the first one's refresh token, since there was only ever one slot to store a hash in. That's the kind of bug that's invisible in single-device testing and immediately obvious the moment someone opens the app on their phone while still logged in on a laptop.

The fix is a proper `Session` row per device:

```prisma
// prisma/schema.prisma
// One row per active login (a user with two tabs open on two phones has two
// rows) — replaces the old single User.refreshTokenHash field, which meant
// logging in on a second device silently logged the first one out.
// refreshTokenHash is SHA-256, same as every other one-way token in this
// schema — NOT bcrypt, which silently truncates its input to 72 bytes and
// would make every refresh token issued for a session hash identically
// (the part that varies falls past the truncation point), defeating
// rotation-reuse detection entirely. (See §16.4.)
model Session {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String
  userAgent        String?
  ipAddress        String?
  createdAt        DateTime @default(now())
  lastUsedAt       DateTime @default(now())

  @@index([userId])
}
```

`sessionId` gets embedded in both the access and refresh JWT payloads, so any request — or a refresh call — can identify exactly which session it belongs to:

```typescript
// auth/types.ts
export interface JwtAccessPayload {
  sub: string; email: string; role: Role; tenantId: string; employeeId: string | null;
  sessionId: string;
}
export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
}
```

Every login-shaped entry point — `login`, `signup`, `acceptInvite`, `resetPassword`, `verifyTwoFactor` — funnels through the same `createSession()`, and `refresh()` through `rotateSession()`, which reuses the existing session id and only updates its hash:

```typescript
// auth/auth.service.ts
private async createSession(user: User, meta: SessionMeta) {
  const session = await this.prisma.session.create({
    data: { userId: user.id, refreshTokenHash: '', userAgent: meta.userAgent, ipAddress: meta.ipAddress },
  });
  return { session, ...(await this.signAndStoreTokens(user, session.id)) };
}
```

`GET /auth/sessions` lists every active device for the caller (flagging which one is "this device"); `DELETE /auth/sessions/:id` revokes one — both scoped to `userId` so one user's request can never touch another's session by guessing an id:

```typescript
// auth/auth.service.ts
async listSessions(userId: string, currentSessionId: string) {
  const sessions = await this.prisma.session.findMany({ where: { userId }, orderBy: { lastUsedAt: 'desc' } });
  return sessions.map((session) => ({
    id: session.id, userAgent: session.userAgent, ipAddress: session.ipAddress,
    createdAt: session.createdAt, lastUsedAt: session.lastUsedAt,
    isCurrent: session.id === currentSessionId,
  }));
}
```

The frontend's `SessionsSettings` panel renders that as a device list with a lightweight user-agent parser (`Chrome on macOS`, `Safari on iOS`) and a "Sign out" confirmation per row; revoking the *current* device's own session calls `useAuth().logout()` locally too, rather than leaving a page up that's signed out on the server but not in the UI:

```typescript
// components/settings/SessionsSettings.tsx
const revokeMutation = useMutation({
  mutationFn: () => revokeSession(session.id),
  onSuccess: async () => {
    if (session.isCurrent) {
      await logout();  // finish the job locally, not just server-side
      return;
    }
    toast.success('Signed out');
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
  },
});
```

Two places outside the auth flow itself needed to know sessions now exist. Terminating an employee (Part 5) used to only flip `User.isActive` — already-issued tokens kept working until they naturally expired, since nothing about `isActive` invalidates a JWT that's already been signed:

```typescript
// employees/employees.service.ts
await tx.user.updateMany({ where: { employeeId }, data: { isActive: false } });
// Sessions aren't cascade-deleted by isActive going false — a terminated
// employee's already-issued tokens must stop working immediately, not
// just future logins being blocked.
await tx.session.deleteMany({ where: { user: { employeeId } } });
```

And `resetPassword` (Part 13 §13.3) now deletes every session for that user as part of the same transaction — exactly the behavior you want after a password compromise or recovery, where a reset should log out every device, not just the one completing it.

## 16.4 The Bug This Refactor Found

Building `Session` meant, for the first time, actually exercising refresh-token rotation across multiple real devices in live testing rather than a single mocked path. That testing surfaced a genuine, previously-undetected security bug: **refresh-token reuse detection had never worked.**

The original code (inherited unchanged from the single-`refreshTokenHash` design) compared tokens with `bcrypt.compare(refreshToken, session.refreshTokenHash)`. bcrypt silently truncates its input to 72 bytes — a signed JWT refresh token is well past that, and the part that actually changes between issuances (`iat`, `exp`, the signature) falls entirely past the truncation point. Every refresh token ever issued for a given session hashed to the exact same bcrypt digest, because bcrypt was only ever looking at the unchanging `sub`+`sessionId` prefix. A stale, already-rotated-out refresh token was therefore accepted forever — the entire point of rotation-reuse detection (treat a replayed old token as a signal of a possible leak, and revoke the session) silently did nothing.

Finding it took escalating through the debugging approach established earlier in this build: a careful curl test with direct `psql` checks around it first ruled out a testing artifact; a standalone `ts-node` script calling `AuthService` directly, with explicit delays between calls, ruled out an `iat`-collision theory; temporary `console.log` instrumentation directly in `refresh()`/`signAndStoreTokens()` finally showed the smoking gun — the hash visibly changing in the database between calls, while `bcrypt.compare` against the *old* token kept returning `true` regardless.

The fix matches the pattern already established everywhere else in this schema for exactly this class of token — `ApiKey`, `EmployeeInvite`, `PasswordResetToken`, 2FA backup codes are all SHA-256, and there was never a reason `Session.refreshTokenHash` should have been the one exception:

```typescript
// auth/auth.service.ts
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async refresh(userId: string, sessionId: string, refreshToken: string) {
  const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new UnauthorizedException('Session expired, please log in again');
  }
  const matches = hashRefreshToken(refreshToken) === session.refreshTokenHash;
  if (!matches) {
    // Reuse of a rotated-out refresh token — revoke the session outright
    // rather than just rejecting, on the theory that a mismatched refresh
    // token is a signal the token may have leaked.
    await this.prisma.session.delete({ where: { id: session.id } });
    throw new UnauthorizedException('Invalid refresh token');
  }
  // ...
}
```

Live-verified against the running dev server, the exact scenario that used to silently pass: log in, refresh once (which rotates the session's stored hash), then replay the *original*, now-stale refresh token. Before the fix, that replay succeeded. After it, it correctly comes back `401 Invalid refresh token`, and the session row is gone:

```
$ curl -X POST /auth/refresh -H "Authorization: Bearer $STALE_TOKEN"
{"message":"Invalid refresh token","error":"Unauthorized","statusCode":401}

$ psql -c 'SELECT id FROM "Session" WHERE id = ...'
(0 rows)
```

The lesson generalizes past this one field: bcrypt's 72-byte truncation isn't a theoretical footgun, it's silently wrong for anything token-shaped and long, and it will not raise an error to tell you — it just returns `true` for inputs that shouldn't match. Every hashing choice in this codebase now follows one rule: bcrypt only for a real user-chosen password (where its deliberate slowness is the point), SHA-256 for everything machine-generated and high-entropy.

Part 17 turns to a different reliability question — not who can get in, but what happens after a payroll run, when a hundred payslip emails all need to go out at once.
