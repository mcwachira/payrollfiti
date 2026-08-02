import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@acme.co.ke',
    passwordHash: 'hashed-password',
    role: Role.ADMIN,
    isActive: true,
    employeeId: null,
    refreshTokenHash: null as string | null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: asyncMock(user),
        update: asyncMock({ ...user, refreshTokenHash: 'new-hash' }),
      },
      $transaction: jest.fn(),
    };
    jwtService = { signAsync: asyncMock('signed-token') };

    (bcryptMock.hash as jest.Mock).mockResolvedValue(
      'hashed-password' as never,
    );
    (bcryptMock.compare as jest.Mock).mockResolvedValue(true as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'jwt') {
                return {
                  accessSecret: 'access-secret',
                  accessExpiresIn: '15m',
                  refreshSecret: 'refresh-secret',
                  refreshExpiresIn: '7d',
                };
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('signup', () => {
    const dto = {
      tenantName: 'Acme Ltd',
      countryCode: 'KE',
      adminEmail: 'admin@acme.co.ke',
      adminPassword: 'Password123!',
    };

    it('creates a tenant + admin user and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const tenant = { id: 'tenant-1', name: 'Acme Ltd', countryCode: 'KE' };
      const txPrisma = {
        tenant: { create: asyncMock(tenant) },
        user: { create: asyncMock(user) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

      const result = await service.signup(dto);

      expect(result.tenant).toBe(tenant);
      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(txPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.ADMIN }),
        }),
      );
      expect(txPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countryCode: 'KE',
            defaultCurrency: 'KES',
          }),
        }),
      );
    });

    it('derives defaultCurrency from the signup country rather than hardcoding KES', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const tenant = { id: 'tenant-2', name: 'Acme NG', countryCode: 'NG' };
      const txPrisma = {
        tenant: { create: asyncMock(tenant) },
        user: { create: asyncMock(user) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

      await service.signup({ ...dto, countryCode: 'NG' });

      expect(txPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            countryCode: 'NG',
            defaultCurrency: 'NGN',
          }),
        }),
      );
    });

    it('throws ConflictException when the email is already in use', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto = { email: user.email, password: 'Password123!' };

    it('returns tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);

      const result = await service.login(dto);

      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);
      (bcryptMock.compare as jest.Mock).mockResolvedValueOnce(false as never);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an inactive user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        isActive: false,
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('returns new tokens when the refresh token matches the stored hash', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        refreshTokenHash: 'stored-hash',
      });

      const result = await service.refresh(user.id, 'valid-refresh-token');

      expect(result.accessToken).toBe('signed-token');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: { refreshTokenHash: expect.any(String) },
        }),
      );
    });

    it('revokes the session (nulls refreshTokenHash) when a stale/reused refresh token is presented', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        refreshTokenHash: 'stored-hash',
      });
      (bcryptMock.compare as jest.Mock).mockResolvedValueOnce(false as never);

      await expect(
        service.refresh(user.id, 'stale-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
    });

    it('throws UnauthorizedException when the user has no stored refresh token hash', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        refreshTokenHash: null,
      });

      await expect(service.refresh(user.id, 'whatever')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the stored refreshTokenHash', async () => {
      await service.logout(user.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
    });
  });
});
