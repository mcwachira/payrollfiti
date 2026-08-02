import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as otplib from 'otplib';
import QRCode from 'qrcode';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { MailService } from '../notifications/mail.service';
import { EncryptionService } from '../common/crypto/encryption.service';

jest.mock('bcrypt');
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

// Manual factory mocks — otplib (and its @scure/base dependency) and
// qrcode both ship ESM that automock's "require the real module to learn
// its shape" step can't parse under Jest's CJS transform. A factory avoids
// ever loading the real modules.
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(),
}));
const otplibMock = otplib as jest.Mocked<typeof otplib>;

jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));
const qrcodeMock = QRCode as jest.Mocked<typeof QRCode>;

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
  let billingService: any;
  let mailService: any;
  let encryptionService: any;

  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@acme.co.ke',
    passwordHash: 'hashed-password',
    role: Role.ADMIN,
    isActive: true,
    employeeId: null,
    refreshTokenHash: null as string | null,
    twoFactorEnabled: false,
    twoFactorSecretEncrypted: null as string | null,
    twoFactorBackupCodes: [] as string[],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findUnique: asyncMock(user),
        findUniqueOrThrow: asyncMock(user),
        update: asyncMock({ ...user, refreshTokenHash: 'new-hash' }),
      },
      employeeInvite: {
        findUnique: asyncMock(null),
        delete: asyncMock(undefined),
      },
      passwordResetToken: {
        findUnique: asyncMock(null),
        upsert: asyncMock(undefined),
        delete: asyncMock(undefined),
      },
      $transaction: jest.fn(),
    };
    jwtService = {
      signAsync: asyncMock('signed-token'),
      verifyAsync: asyncMock({ purpose: '2fa-challenge', sub: user.id }),
    };
    billingService = { startTrial: asyncMock(undefined) };
    mailService = { sendMail: asyncMock(undefined) };
    encryptionService = {
      encrypt: jest.fn((value: string) => `enc(${value})`),
      decrypt: jest.fn((value: string) => value.replace(/^enc\(|\)$/g, '')),
    };

    (bcryptMock.hash as jest.Mock).mockResolvedValue(
      'hashed-password' as never,
    );
    (bcryptMock.compare as jest.Mock).mockResolvedValue(true as never);

    (otplibMock.generateSecret as jest.Mock).mockResolvedValue(
      'BASE32SECRET' as never,
    );
    (otplibMock.generateURI as jest.Mock).mockReturnValue(
      'otpauth://totp/PayrollFiti:admin@acme.co.ke?secret=BASE32SECRET&issuer=PayrollFiti' as never,
    );
    (otplibMock.verify as jest.Mock).mockResolvedValue({
      valid: true,
    } as never);
    (qrcodeMock.toDataURL as unknown as jest.Mock).mockResolvedValue(
      'data:image/png;base64,fake' as never,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: BillingService, useValue: billingService },
        { provide: MailService, useValue: mailService },
        { provide: EncryptionService, useValue: encryptionService },
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
              if (key === 'corsOrigin') return 'http://localhost:4200';
              if (key === 'appName') return 'PayrollFiti';
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
      expect(billingService.startTrial).toHaveBeenCalledWith(tenant.id);
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

      if (!('accessToken' in result)) {
        throw new Error('expected a full token response, not a 2FA challenge');
      }
      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);
      (bcryptMock.compare as jest.Mock).mockResolvedValueOnce(false as never);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns a 2FA challenge instead of tokens when the user has 2FA enabled', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
      });

      const result = await service.login(dto);

      expect(result).toEqual({
        twoFactorRequired: true,
        challengeToken: 'signed-token',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { purpose: '2fa-challenge', sub: user.id },
        expect.objectContaining({ secret: 'access-secret', expiresIn: '5m' }),
      );
    });

    it('throws UnauthorizedException for an inactive user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        isActive: false,
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('acceptInvite', () => {
    const dto = { token: 'raw-token-value', password: 'Password123!' };
    const invite = {
      id: 'invite-1',
      employeeId: 'emp-1',
      email: 'employee@acme.co.ke',
      expiresAt: new Date(Date.now() + 60_000),
      employee: { company: { tenantId: 'tenant-1' } },
    };
    const employeeUser = {
      id: 'user-2',
      tenantId: 'tenant-1',
      email: invite.email,
      role: Role.EMPLOYEE,
      employeeId: 'emp-1',
    };

    it('creates the User, deletes the single-use invite, and logs the new employee in', async () => {
      prisma.employeeInvite.findUnique.mockResolvedValueOnce(invite);
      const txPrisma = {
        user: { create: asyncMock(employeeUser) },
        employeeInvite: { delete: asyncMock(undefined) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

      const result = await service.acceptInvite(dto);

      expect(txPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            email: invite.email,
            role: Role.EMPLOYEE,
            employeeId: 'emp-1',
          }),
        }),
      );
      expect(txPrisma.employeeInvite.delete).toHaveBeenCalledWith({
        where: { id: invite.id },
      });
      expect(result.user.role).toBe(Role.EMPLOYEE);
      expect(result.accessToken).toBe('signed-token');
    });

    it('rejects an unknown token without touching the database further', async () => {
      prisma.employeeInvite.findUnique.mockResolvedValueOnce(null);

      await expect(service.acceptInvite(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an expired invite', async () => {
      prisma.employeeInvite.findUnique.mockResolvedValueOnce({
        ...invite,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.acceptInvite(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('translates a unique-constraint race on email into a clear ConflictException, e.g. the email got claimed by a signup between the invite being sent and redeemed', async () => {
      prisma.employeeInvite.findUnique.mockResolvedValueOnce(invite);
      const constraintError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: 'test' },
      );
      prisma.$transaction.mockImplementation(() =>
        Promise.reject(constraintError),
      );

      await expect(service.acceptInvite(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('creates a reset token and emails a reset link when the email is registered', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(user);

      await service.forgotPassword({ email: user.email });

      expect(prisma.passwordResetToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: user.id },
          create: expect.objectContaining({ userId: user.id }),
          update: expect.any(Object),
        }),
      );
      expect(mailService.sendMail).toHaveBeenCalledWith(
        user.email,
        expect.any(String),
        expect.stringContaining('http://localhost:4200/reset-password?token='),
      );
    });

    it('silently resolves for an unregistered email, without creating a token or sending mail', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.forgotPassword({ email: 'nobody@acme.co.ke' }),
      ).resolves.toBeUndefined();
      expect(prisma.passwordResetToken.upsert).not.toHaveBeenCalled();
      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const dto = { token: 'raw-reset-token', password: 'NewPassword123!' };
    const resetToken = {
      id: 'reset-1',
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    };

    it('updates the password, deletes the token, and logs the user in', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(resetToken);
      const txPrisma = {
        user: { update: asyncMock({ ...user, passwordHash: 'new-hash' }) },
        passwordResetToken: { delete: asyncMock(undefined) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

      const result = await service.resetPassword(dto);

      expect(txPrisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { passwordHash: 'hashed-password' },
      });
      expect(txPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { id: resetToken.id },
      });
      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBe('signed-token');
    });

    it('rejects an unknown token without touching the database further', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        ...resetToken,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.resetPassword(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getTwoFactorStatus', () => {
    it('reports whether the user has 2FA enabled', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
      });

      await expect(service.getTwoFactorStatus(user.id)).resolves.toEqual({
        enabled: true,
      });
    });
  });

  describe('setupTwoFactor', () => {
    it('generates and stores an encrypted secret, returning a QR code', async () => {
      const result = await service.setupTwoFactor(user.id);

      expect(result).toEqual({
        secret: 'BASE32SECRET',
        otpauthUrl: expect.stringContaining('otpauth://totp/'),
        qrCodeDataUrl: 'data:image/png;base64,fake',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { twoFactorSecretEncrypted: 'enc(BASE32SECRET)' },
      });
      expect(otplibMock.generateURI).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'totp',
          issuer: 'PayrollFiti',
          label: user.email,
          secret: 'BASE32SECRET',
        }),
      );
    });
  });

  describe('enableTwoFactor', () => {
    it('verifies the code, enables 2FA, and returns backup codes', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
      });

      const result = await service.enableTwoFactor(user.id, { code: '123456' });

      expect(result.backupCodes).toHaveLength(10);
      expect(result.backupCodes[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(otplibMock.verify).toHaveBeenCalledWith({
        secret: 'BASE32SECRET',
        token: '123456',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorBackupCodes: expect.arrayContaining([expect.any(String)]),
        },
      });
    });

    it('throws BadRequestException when setup was never called', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorSecretEncrypted: null,
      });

      await expect(
        service.enableTwoFactor(user.id, { code: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException for an invalid code', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
      });
      (otplibMock.verify as jest.Mock).mockResolvedValueOnce({
        valid: false,
      } as never);

      await expect(
        service.enableTwoFactor(user.id, { code: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('disableTwoFactor', () => {
    const dto = { password: 'Password123!', code: '123456' };

    it('clears the secret and backup codes once password and code both check out', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
      });

      await service.disableTwoFactor(user.id, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecretEncrypted: null,
          twoFactorBackupCodes: [],
        },
      });
    });

    it('rejects a wrong password without checking the code at all', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
      });
      (bcryptMock.compare as jest.Mock).mockResolvedValueOnce(false as never);

      await expect(service.disableTwoFactor(user.id, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(otplibMock.verify).not.toHaveBeenCalled();
    });

    it('rejects an invalid code even with the correct password', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
      });
      (otplibMock.verify as jest.Mock).mockResolvedValueOnce({
        valid: false,
      } as never);

      await expect(service.disableTwoFactor(user.id, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('accepts a valid backup code in place of a TOTP code', async () => {
      const backupCodeHash =
        'e23c9d920c3cc58becb9540027754506eb209e88c5271efab2d6d2cab77f76a8'; // sha256("PASSWORD123") — the normalized form of 'password123'
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
        twoFactorBackupCodes: [backupCodeHash],
      });
      (otplibMock.verify as jest.Mock).mockResolvedValueOnce({
        valid: false,
      } as never);

      await service.disableTwoFactor(user.id, { ...dto, code: 'password123' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecretEncrypted: null,
          twoFactorBackupCodes: [],
        },
      });
    });
  });

  describe('verifyTwoFactor', () => {
    const dto = { challengeToken: 'challenge-jwt', code: '123456' };

    it('redeems a valid challenge + code into real tokens', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
      });

      const result = await service.verifyTwoFactor(dto);

      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBe('signed-token');
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('challenge-jwt', {
        secret: 'access-secret',
      });
    });

    it('rejects when the challenge token fails verification', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

      await expect(service.verifyTwoFactor(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a challenge token signed for a different purpose', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        purpose: 'accounting-oauth-state',
        sub: user.id,
      });

      await expect(service.verifyTwoFactor(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an invalid code', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
      });
      (otplibMock.verify as jest.Mock).mockResolvedValueOnce({
        valid: false,
      } as never);

      await expect(service.verifyTwoFactor(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('falls back to a backup code when otplib rejects a non-TOTP-shaped token instead of crashing', async () => {
      // Regression: otplib.verify() throws (rather than resolving
      // {valid:false}) for a malformed token — a backup code like
      // "WDPA-WR2C" is neither 6 digits nor otherwise well-formed, which
      // surfaced as a raw 500 instead of falling through to the backup-code
      // check below.
      const backupCodeHash =
        'e23c9d920c3cc58becb9540027754506eb209e88c5271efab2d6d2cab77f76a8'; // sha256("PASSWORD123")
      prisma.user.findUnique.mockResolvedValueOnce({
        ...user,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: 'enc(BASE32SECRET)',
        twoFactorBackupCodes: [backupCodeHash],
      });
      (otplibMock.verify as jest.Mock).mockRejectedValueOnce(
        new Error('Token must be 6 digits, got 9') as never,
      );

      const result = await service.verifyTwoFactor({
        ...dto,
        code: 'password123',
      });

      expect(result.accessToken).toBe('signed-token');
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
