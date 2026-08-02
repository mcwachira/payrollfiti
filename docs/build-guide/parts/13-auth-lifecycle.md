# Part 13 — Employee Onboarding & Authentication

Part 4 §4.4 covered JWT issuance and refresh, but only for the `signup()` path — one `ADMIN` creating a brand-new tenant. It never answered three questions that come up the moment a second, non-admin person needs to use the system: how does an employee get an account at all, where do they and the employer actually log in, and what happens when either of them forgets a password. This part closes all three, in the order a real rollout hits them.

## 13.1 Who Logs In Where

There is no subdomain-per-tenant scheme and no separate employee login page. `User.email` is globally unique — not scoped per tenant — so one email address can only ever back a single login, whatever its role. Every user, `ADMIN`, `HR`, or `EMPLOYEE`, authenticates at the same `/login` page; the API doesn't even know which "kind" of login is being attempted until the credentials resolve to a `User` row with a `role` on it.

What differs is where login sends you afterward. `/dashboard` calls `GET /employees` and `GET /payroll-runs`, both gated `@Roles(ADMIN, HR)` — an `EMPLOYEE` landing there would get two 403s instead of their portal, so the frontend branches on the role returned by the login response, not by asking twice:

```typescript
// contexts/AuthContext.tsx
const login = useCallback(async (email: string, password: string) => {
  const data = await apiFetch<{ user: AuthenticatedUserDto } & AuthTokensDto>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true },
  );
  // Not scoped by tenant/user identity — without this, switching accounts
  // in the same tab could keep showing the PREVIOUS session's cached data.
  queryClient.clear();
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  setUser(data.user);
  return data.user; // returned, not just set into state — see login/page.tsx below
}, [queryClient]);
```

```typescript
// app/(auth)/login/page.tsx
const user = await login(email, password);
router.push(user.role === Role.EMPLOYEE ? '/employee-portal' : '/dashboard');
```

`login()` returns the freshly-fetched user rather than leaving the caller to read it back off the `useAuth()` hook — reading `user` from the hook immediately after `await login()` would still see the *previous* render's value, since `setUser()` doesn't re-render the calling closure synchronously.

The same role split governs what's even visible before a click. `Sidebar.tsx` tags every nav entry with an `allow: Role[]` and filters at render time; `RoleRedirectGuard` backstops it for direct URL access — six pages (Dashboard, Employees, Payroll, Leave Management, Analytics, Compliance) are wrapped so an `EMPLOYEE` navigating there directly, not just clicking a hidden link, still lands somewhere real instead of an error state built around data their role can't fetch:

```typescript
// components/RoleRedirectGuard.tsx
export function RoleRedirectGuard({ allow, children }: PropsWithChildren<{ allow: Role[] }>) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !allow.includes(user.role)) {
      router.replace('/employee-portal');
    }
  }, [isLoading, user, allow, router]);

  if (isLoading || !user || !allow.includes(user.role)) return null;
  return <>{children}</>;
}
```

This is deliberately a *redirect*, not the inline "you don't have permission" card `RoleGuard` renders elsewhere (Settings, for instance) — those are pages a user might legitimately attempt and should be told why they can't; Dashboard/Employees/Payroll/etc. are pages an `EMPLOYEE` should never see the shape of at all.

## 13.2 Employee Invites — From HR Action to Portal Access

`ADMIN`/`HR` create `Employee` records directly (Part 5 §5.1) for payroll purposes, but an `Employee` row has no login by itself — `Employee.user` is an optional 1:1. Portal access is a deliberate, separate action: `POST /employees/:id/invite`.

```prisma
// prisma/schema.prisma
// A pending employee-portal signup. Deleted the moment it's redeemed — there
// is deliberately no "used" flag to check, since a redeemed invite has
// nothing left to represent once the real User row exists. tokenHash mirrors
// ApiKey's pattern: a one-way SHA-256 digest, never the raw token itself.
model EmployeeInvite {
  id          String   @id @default(uuid())
  employeeId  String   @unique
  employee    Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  email       String
  tokenHash   String   @unique
  expiresAt   DateTime
  createdById String?
  createdAt   DateTime @default(now())
}
```

```typescript
// employees/employees.service.ts
async invite(tenantId: string, actorId: string, employeeId: string) {
  const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { company: true, user: true } });
  if (!employee || employee.company.tenantId !== tenantId) throw new NotFoundException('Employee not found');
  if (employee.user) throw new BadRequestException('This employee already has portal access');

  // User.email is unique system-wide, not per-tenant. Without this check the
  // invite still sends, and only fails confusingly — a raw 500 — when the
  // person actually tries to redeem it, by which point it's too late to
  // give them a clear next step.
  const existingAccount = await this.prisma.user.findUnique({ where: { email: employee.email } });
  if (existingAccount) {
    throw new BadRequestException(
      `An account already exists for ${employee.email} — one email can only be linked to a single login. Use a different email for this employee, or update the existing account's role if this is the same person.`,
    );
  }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + EmployeesService.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await this.prisma.employeeInvite.upsert({
    where: { employeeId },
    create: { employeeId, email: employee.email, tokenHash, expiresAt, createdById: actorId },
    update: { email: employee.email, tokenHash, expiresAt, createdById: actorId },
  });

  const inviteUrl = `${this.configService.get('corsOrigin', { infer: true })}/accept-invite?token=${rawToken}`;
  await this.mailService.sendMail(employee.email, "You're invited to the employee portal",
    `<p>Hi ${employee.firstName},</p><p><a href="${inviteUrl}">Set up your account</a></p>` +
    `<p>This link expires in ${EmployeesService.INVITE_EXPIRY_DAYS} days.</p>`);
}
```

The raw token is only ever in memory and in the emailed link — the database keeps just its SHA-256 hash, same pattern as `ApiKey`. Redemption is symmetric: hash whatever token comes back, look it up, and — critically — never trust the frontend for the role or tenant being granted:

```typescript
// auth/auth.service.ts
async acceptInvite(dto: AcceptInviteDto) {
  const tokenHash = createHash('sha256').update(dto.token).digest('hex');
  const invite = await this.prisma.employeeInvite.findUnique({
    where: { tokenHash }, include: { employee: { include: { company: true } } },
  });
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedException('This invite link is invalid or has expired');
  }

  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
  let user: User;
  try {
    user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { tenantId: invite.employee.company.tenantId, email: invite.email, passwordHash, role: Role.EMPLOYEE, employeeId: invite.employeeId },
      });
      await tx.employeeInvite.delete({ where: { id: invite.id } });
      return created;
    });
  } catch (error) {
    // The upfront check in invite() already covers this, but the email
    // could still be claimed by a brand-new signup in the window between
    // an invite being sent and redeemed — surface that clearly rather than
    // a raw constraint error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`An account already exists for ${invite.email}. Sign in with that email instead.`);
    }
    throw error;
  }

  return { user: this.toAuthenticatedUser(user), ...(await this.issueTokens(user)) };
}
```

`role: Role.EMPLOYEE` and `tenantId: invite.employee.company.tenantId` are both server-derived from the invite row, never from the request body — `AcceptInviteDto` only carries `token` and `password`. The frontend page is a thin form over this one call:

```typescript
// app/(auth)/accept-invite/page.tsx
const token = useSearchParams().get('token');
// ...
await acceptInvite(token, password);       // POST /auth/accept-invite, auto-logs in
router.push('/employee-portal');
```

End to end: HR clicks "Invite" on an employee record → API emails a link → employee opens it, sets a password → they're logged into `/employee-portal` immediately, using the same `/login` page as everyone else from then on.

## 13.3 Forgot & Reset Password — One Flow for Every Role

Login is unified, so password recovery is too — there's no role branch anywhere in this flow. It reuses the exact token pattern from §13.2: a one-way-hashed, short-lived, single-use token, emailed as a link.

```prisma
// prisma/schema.prisma
// One row per user with an active reset request. userId is unique so a new
// request supersedes any previous unused one rather than accumulating rows.
model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

```typescript
// auth/auth.service.ts
private static readonly RESET_TOKEN_EXPIRY_HOURS = 1;

// Always resolves the same way whether or not the email is registered —
// a caller can't use this to probe which addresses have accounts.
async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
  if (!user) return;

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + AuthService.RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await this.prisma.passwordResetToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tokenHash, expiresAt },
    update: { tokenHash, expiresAt },
  });

  const resetUrl = `${this.configService.get('corsOrigin', { infer: true })}/reset-password?token=${rawToken}`;
  await this.mailService.sendMail(user.email, 'Reset your password',
    `<p><a href="${resetUrl}">Choose a new password</a></p><p>This link expires in 1 hour.</p>`);
}

// Reissuing tokens here overwrites refreshTokenHash, which as a side effect
// invalidates any refresh token from a session issued before the reset —
// exactly the behavior you want after a password compromise or recovery.
async resetPassword(dto: ResetPasswordDto) {
  const tokenHash = createHash('sha256').update(dto.token).digest('hex');
  const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!resetToken || resetToken.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedException('This password reset link is invalid or has expired');
  }

  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
  const user = await this.prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
    await tx.passwordResetToken.delete({ where: { id: resetToken.id } });
    return updated;
  });

  return { user: this.toAuthenticatedUser(user), ...(await this.issueTokens(user)) };
}
```

Both endpoints are `@Public()` — the token itself, not a session, is what's being verified — and both return `200` on success rather than a body-shaped resource, except `resetPassword`, which returns the same `{ user, accessToken, refreshToken }` shape as `login`/`acceptInvite` so the frontend can log the user straight in:

```typescript
// app/(auth)/forgot-password/page.tsx
await forgotPassword(email);
setSubmitted(true); // always shown, success or not — see the service method above
```

```
"If an account exists for {email}, we've sent a link to reset your
password. It expires in 1 hour."
```

```typescript
// app/(auth)/reset-password/page.tsx
const token = useSearchParams().get('token');
const user = await resetPassword(token, password);
router.push(user.role === Role.EMPLOYEE ? '/employee-portal' : '/dashboard');
```

A "Forgot password?" link sits next to the password field on `/login`, pointing at `/forgot-password`. That closes the loop: `/login` is the one door in for both roles, `/accept-invite` is how an `EMPLOYEE` gets a key to it in the first place, and `/forgot-password` → `/reset-password` is how either role gets back in when the key is lost — three pages, one `User` table, no role-specific code path anywhere in the chain.

Part 14 turns to a different gap: none of this — login, invites, password reset — was reachable as an installed app with real push notifications until now. It picks up where Part 10 §10.7's baseline Serwist setup left off.
