import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Role, User } from '@prisma/client';
import { getPricingForCountry } from '@repo/pricing';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthenticatedRequestUser,
  JwtAccessPayload,
  JwtRefreshPayload,
} from './types';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
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
