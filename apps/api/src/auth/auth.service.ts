import { randomBytes, createHash } from 'crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, User } from '@prisma/client';
import { getPricingForCountry } from '@repo/pricing';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { MailService } from '../notifications/mail.service';
import { AppConfig } from '../config/configuration';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  AuthenticatedRequestUser,
  JwtAccessPayload,
  JwtRefreshPayload,
} from './types';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private static readonly RESET_TOKEN_EXPIRY_HOURS = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly billingService: BillingService,
    private readonly mailService: MailService,
  ) {}

  async signup(dto: SignupDto) {
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

    const tokens = await this.issueTokens(user);
    return { tenant, user: this.toAuthenticatedUser(user), ...tokens };
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

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    const tokens = await this.issueTokens(user);
    return { user: this.toAuthenticatedUser(user), ...tokens };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Session expired, please log in again');
    }
    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      // Reuse of a rotated-out refresh token — revoke the session outright.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    const tokens = await this.issueTokens(user);
    return { user: this.toAuthenticatedUser(user), ...tokens };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  /**
   * Redeems an EmployeeInvite (see EmployeesService.invite) into a real
   * login: creates the User row linked to the Employee, deletes the
   * single-use invite, and logs the new user in immediately — same shape
   * of response as signup/login, so the frontend can treat it identically.
   * Public — the token itself, not a session, is what's being verified.
   */
  async acceptInvite(dto: AcceptInviteDto) {
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

    const tokens = await this.issueTokens(user);
    return { user: this.toAuthenticatedUser(user), ...tokens };
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
   * immediately, same shape of response as login/acceptInvite. Reissuing
   * tokens here overwrites refreshTokenHash, which as a side effect
   * invalidates any refresh token from a session issued before the reset —
   * exactly the behavior you want after a password compromise/recovery.
   */
  async resetPassword(dto: ResetPasswordDto) {
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
      return updated;
    });

    const tokens = await this.issueTokens(user);
    return { user: this.toAuthenticatedUser(user), ...tokens };
  }

  private async issueTokens(user: User) {
    const jwtConfig = this.configService.get('jwt', { infer: true });

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
    };
    const refreshPayload: JwtRefreshPayload = { sub: user.id };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: jwtConfig.refreshSecret,
      expiresIn: jwtConfig.refreshExpiresIn,
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }

  private toAuthenticatedUser(user: User): AuthenticatedRequestUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      employeeId: user.employeeId,
    };
  }
}
