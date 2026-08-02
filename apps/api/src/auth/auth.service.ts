import { randomBytes, createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as otplib from 'otplib';
import QRCode from 'qrcode';
import { Prisma, Role, Session, User } from '@prisma/client';
import { getPricingForCountry } from '@repo/pricing';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { MailService } from '../notifications/mail.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { AppConfig } from '../config/configuration';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorEnableDto } from './dto/two-factor-enable.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import {
  AuthenticatedRequestUser,
  JwtAccessPayload,
  JwtRefreshPayload,
} from './types';

const SALT_ROUNDS = 12;
const TWO_FACTOR_CHALLENGE_PURPOSE = '2fa-challenge';
const TWO_FACTOR_CHALLENGE_EXPIRES_IN = '5m';
const BACKUP_CODE_COUNT = 10;
// Excludes 0/O/1/I — ambiguous when handwritten/misread from a printed sheet.
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Captured from the HTTP request at the controller layer — where a Session
 *  actually originated (browser/device), not something a DTO body carries. */
export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

function generateBackupCode(): string {
  const chars = Array.from(
    randomBytes(8),
    (byte) => BACKUP_CODE_ALPHABET[byte % BACKUP_CODE_ALPHABET.length],
  );
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashBackupCode(code: string): string {
  return createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
}

/**
 * SHA-256, not bcrypt — same choice as ApiKey/EmployeeInvite/
 * PasswordResetToken elsewhere in this schema, and for the same reason
 * (a high-entropy, machine-generated token has no brute-force risk bcrypt's
 * deliberate slowness defends against). Unlike those tokens, this one isn't
 * optional here: bcrypt silently truncates its input to 72 bytes, and a JWT
 * refresh token is far longer than that with the part that actually varies
 * between issuances (iat/exp/signature) falling past the truncation point —
 * every token for a given session would hash identically, silently
 * defeating rotation-reuse detection.
 */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * otplib.verify() throws rather than returning { valid: false } for a
 * malformed token — a backup code like "WDPA-WR2C" being tried here (see
 * verifyTwoFactorCode below) is neither 6 digits nor otherwise well-formed,
 * so unlike a plain "wrong code" this is an expected, routine input this
 * function must not let escape as an unhandled 500.
 */
async function verifyTotpSafely(
  secret: string,
  token: string,
): Promise<boolean> {
  try {
    const result = await otplib.verify({ secret, token });
    return result.valid;
  } catch {
    return false;
  }
}

@Injectable()
export class AuthService {
  private static readonly RESET_TOKEN_EXPIRY_HOURS = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly billingService: BillingService,
    private readonly mailService: MailService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async signup(dto: SignupDto, meta: SessionMeta = {}) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, SALT_ROUNDS);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          countryCode: dto.countryCode,
          // Falls back to the same default country's currency as
          // @repo/pricing when the signup country isn't priced yet, rather
          // than silently defaulting every tenant to KES regardless of
          // country.
          defaultCurrency: getPricingForCountry(dto.countryCode).currency,
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          passwordHash,
          role: Role.ADMIN,
        },
      });
      return { tenant, user };
    });

    // Best-effort, outside the signup transaction — a plan-catalog issue
    // must never roll back account creation (see BillingService.startTrial).
    await this.billingService.startTrial(tenant.id);

    const { session, ...tokens } = await this.createSession(user, meta);
    return {
      tenant,
      user: this.toAuthenticatedUser(user, session.id),
      ...tokens,
    };
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(dto: LoginDto, meta: SessionMeta = {}) {
    const user = await this.validateUser(dto.email, dto.password);
    if (user.twoFactorEnabled) {
      // Password alone doesn't issue tokens — the caller gets a short-lived
      // challenge instead, redeemed via verifyTwoFactor() once they prove
      // they also hold the authenticator/a backup code.
      const challengeToken = await this.jwtService.signAsync(
        { purpose: TWO_FACTOR_CHALLENGE_PURPOSE, sub: user.id },
        {
          secret: this.configService.get('jwt', { infer: true }).accessSecret,
          expiresIn: TWO_FACTOR_CHALLENGE_EXPIRES_IN,
        },
      );
      return { twoFactorRequired: true as const, challengeToken };
    }
    const { session, ...tokens } = await this.createSession(user, meta);
    return { user: this.toAuthenticatedUser(user, session.id), ...tokens };
  }

  async refresh(userId: string, sessionId: string, refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
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
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const tokens = await this.rotateSession(session, user);
    return { user: this.toAuthenticatedUser(user, session.id), ...tokens };
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      isCurrent: session.id === currentSessionId,
    }));
  }

  /** "Sign out this device" — scoped to the caller's own userId so one user can't revoke another's session. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const { count } = await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
    if (count === 0) {
      throw new NotFoundException('Session not found');
    }
  }

  /**
   * Redeems an EmployeeInvite (see EmployeesService.invite) into a real
   * login: creates the User row linked to the Employee, deletes the
   * single-use invite, and logs the new user in immediately — same shape
   * of response as signup/login, so the frontend can treat it identically.
   * Public — the token itself, not a session, is what's being verified.
   */
  async acceptInvite(dto: AcceptInviteDto, meta: SessionMeta = {}) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const invite = await this.prisma.employeeInvite.findUnique({
      where: { tokenHash },
      include: { employee: { include: { company: true } } },
    });
    if (!invite || invite.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(
        'This invite link is invalid or has expired',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            tenantId: invite.employee.company.tenantId,
            email: invite.email,
            passwordHash,
            role: Role.EMPLOYEE,
            employeeId: invite.employeeId,
          },
        });
        await tx.employeeInvite.delete({ where: { id: invite.id } });
        return created;
      });
    } catch (error) {
      // EmployeesService.invite() already checks this before an invite is
      // even sent, but the email could still be claimed by a brand-new
      // signup or another accepted invite in the window between then and
      // now — surface that clearly instead of a raw constraint error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `An account already exists for ${invite.email}. Sign in with that email instead, or ask whoever invited you to resend the invite with a different one.`,
        );
      }
      throw error;
    }

    const { session, ...tokens } = await this.createSession(user, meta);
    return { user: this.toAuthenticatedUser(user, session.id), ...tokens };
  }

  /**
   * One shared flow regardless of role — ADMIN, HR, and EMPLOYEE are all
   * just rows in User, and login itself isn't role-branched either. Always
   * resolves successfully whether or not the email is registered, so a
   * caller can't use this to probe which addresses have accounts.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + AuthService.RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt },
    });

    const corsOrigin = this.configService.get('corsOrigin', { infer: true });
    const resetUrl = `${corsOrigin}/reset-password?token=${rawToken}`;
    await this.mailService.sendMail(
      user.email,
      'Reset your password',
      `<p>We received a request to reset your password.</p>` +
        `<p><a href="${resetUrl}">Choose a new password</a></p>` +
        `<p>This link expires in ${AuthService.RESET_TOKEN_EXPIRY_HOURS} hour${AuthService.RESET_TOKEN_EXPIRY_HOURS === 1 ? '' : 's'}. If you didn't request this, you can safely ignore this email.</p>`,
    );
  }

  /**
   * Redeems a PasswordResetToken (see forgotPassword) and logs the user in
   * immediately, same shape of response as login/acceptInvite. Every other
   * session is deleted as part of this — exactly the behavior you want
   * after a password compromise/recovery, where any session from before
   * the reset should stop working.
   */
  async resetPassword(dto: ResetPasswordDto, meta: SessionMeta = {}) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!resetToken || resetToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(
        'This password reset link is invalid or has expired',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.delete({ where: { id: resetToken.id } });
      await tx.session.deleteMany({ where: { userId: resetToken.userId } });
      return updated;
    });

    const { session, ...tokens } = await this.createSession(user, meta);
    return { user: this.toAuthenticatedUser(user, session.id), ...tokens };
  }

  async getTwoFactorStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: user.twoFactorEnabled };
  }

  /**
   * Generates and stores a new TOTP secret, but leaves twoFactorEnabled
   * false — enableTwoFactor() below is what flips it, only once the user
   * has proven their authenticator app actually produces matching codes.
   * Calling this again before enabling overwrites the previous secret,
   * which is fine: nothing depended on the old one yet.
   */
  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const secret = await otplib.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecretEncrypted: this.encryptionService.encrypt(secret)!,
      },
    });

    const appName = this.configService.get('appName', { infer: true });
    const otpauthUrl = otplib.generateURI({
      strategy: 'totp',
      issuer: appName,
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * Confirms setupTwoFactor()'s secret with a real code, flips
   * twoFactorEnabled, and issues one-time-viewable backup codes. Only their
   * hashes are persisted (see hashBackupCode) — same "shown once" treatment
   * as an ApiKey's raw value.
   */
  async enableTwoFactor(userId: string, dto: TwoFactorEnableDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.twoFactorSecretEncrypted) {
      throw new BadRequestException('Call /auth/2fa/setup first');
    }

    const secret = this.encryptionService.decrypt(
      user.twoFactorSecretEncrypted,
    )!;
    const isValid = await verifyTotpSafely(secret, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid code');
    }

    const backupCodes = Array.from(
      { length: BACKUP_CODE_COUNT },
      generateBackupCode,
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: backupCodes.map(hashBackupCode),
      },
    });
    return { backupCodes };
  }

  /** Requires the current password AND a valid code — either is compromisable alone; both together is the same bar as changing a password normally would need. */
  async disableTwoFactor(
    userId: string,
    dto: TwoFactorDisableDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const codeValid = await this.verifyTwoFactorCode(user, dto.code);
    if (!codeValid) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretEncrypted: null,
        twoFactorBackupCodes: [],
      },
    });
  }

  /** Redeems the challenge from login() into real tokens — same response shape as login/acceptInvite. */
  async verifyTwoFactor(dto: TwoFactorVerifyDto, meta: SessionMeta = {}) {
    let payload: { purpose: string; sub: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.challengeToken, {
        secret: this.configService.get('jwt', { infer: true }).accessSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'This login attempt has expired — please sign in again',
      );
    }
    if (payload.purpose !== TWO_FACTOR_CHALLENGE_PURPOSE) {
      throw new UnauthorizedException(
        'This login attempt has expired — please sign in again',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException(
        'This login attempt has expired — please sign in again',
      );
    }

    const codeValid = await this.verifyTwoFactorCode(user, dto.code);
    if (!codeValid) {
      throw new UnauthorizedException('Invalid code');
    }

    const { session, ...tokens } = await this.createSession(user, meta);
    return { user: this.toAuthenticatedUser(user, session.id), ...tokens };
  }

  /** Tries a live TOTP code first, then falls back to a single-use backup code (consuming it on match). */
  private async verifyTwoFactorCode(
    user: User,
    code: string,
  ): Promise<boolean> {
    if (user.twoFactorSecretEncrypted) {
      const secret = this.encryptionService.decrypt(
        user.twoFactorSecretEncrypted,
      )!;
      if (await verifyTotpSafely(secret, code)) return true;
    }

    const codeHash = hashBackupCode(code);
    if (user.twoFactorBackupCodes.includes(codeHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: user.twoFactorBackupCodes.filter(
            (hash) => hash !== codeHash,
          ),
        },
      });
      return true;
    }

    return false;
  }

  /** Creates a brand-new Session row — every login-shaped entry point (login,
   *  signup, acceptInvite, resetPassword, verifyTwoFactor) calls this, never
   *  rotateSession, since none of them have an existing session to rotate. */
  private async createSession(user: User, meta: SessionMeta) {
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        // Placeholder overwritten immediately below — the real hash needs
        // the session's own id first (it's embedded in the refresh token
        // payload), so the row has to exist before it can be signed.
        refreshTokenHash: '',
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    const tokens = await this.signAndStoreTokens(user, session.id);
    return { session, ...tokens };
  }

  /** refresh() calls this instead of createSession — same session id carries forward, only its hash/lastUsedAt change. */
  private async rotateSession(session: Session, user: User) {
    return this.signAndStoreTokens(user, session.id);
  }

  private async signAndStoreTokens(user: User, sessionId: string) {
    const jwtConfig = this.configService.get('jwt', { infer: true });

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      sessionId,
    };
    const refreshPayload: JwtRefreshPayload = { sub: user.id, sessionId };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: jwtConfig.refreshSecret,
      expiresIn: jwtConfig.refreshExpiresIn,
    });

    const refreshTokenHash = hashRefreshToken(refreshToken);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { refreshTokenHash, lastUsedAt: new Date() },
    });

    return { accessToken, refreshToken };
  }

  private toAuthenticatedUser(
    user: User,
    sessionId: string,
  ): AuthenticatedRequestUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
      sessionId,
    };
  }
}
