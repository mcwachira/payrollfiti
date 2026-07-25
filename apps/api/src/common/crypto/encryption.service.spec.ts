import { describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const TEST_KEY = 'a'.repeat(64);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'encryptionKey') return TEST_KEY;
              if (key === 'nodeEnv') return 'test';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(EncryptionService);
  });

  it('round-trips a plaintext value through encrypt/decrypt', () => {
    const plaintext = 'A123456789Z';
    const ciphertext = service.encrypt(plaintext);

    expect(ciphertext).not.toBeNull();
    expect(ciphertext).not.toBe(plaintext);
    expect(service.decrypt(ciphertext)).toBe(plaintext);
  });

  it('passes through null for encrypt', () => {
    expect(service.encrypt(null)).toBeNull();
  });

  it('passes through undefined for encrypt', () => {
    expect(service.encrypt(undefined)).toBeNull();
  });

  it('passes through null for decrypt', () => {
    expect(service.decrypt(null)).toBeNull();
  });

  it('passes through undefined for decrypt', () => {
    expect(service.decrypt(undefined)).toBeNull();
  });

  it('passes through empty string as null (falsy)', () => {
    expect(service.encrypt('')).toBeNull();
    expect(service.decrypt('')).toBeNull();
  });

  it('produces different ciphertext across two calls with the same plaintext (random IV)', () => {
    const plaintext = 'same-plaintext-value';
    const first = service.encrypt(plaintext);
    const second = service.encrypt(plaintext);

    expect(first).not.toBe(second);
    expect(service.decrypt(first)).toBe(plaintext);
    expect(service.decrypt(second)).toBe(plaintext);
  });

  it('throws InternalServerErrorException for a garbage/legacy-plaintext input', () => {
    expect(() => service.decrypt('not-a-valid-ciphertext')).toThrow(
      InternalServerErrorException,
    );
    expect(() => service.decrypt('plain-legacy-value-123')).toThrow(
      InternalServerErrorException,
    );
  });

  it('refuses to construct when ENCRYPTION_KEY is unset in production (fail closed, not a silent zero-key fallback)', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'encryptionKey') return undefined;
        if (key === 'nodeEnv') return 'production';
        return undefined;
      },
    };

    await expect(
      Test.createTestingModule({
        providers: [
          EncryptionService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile(),
    ).rejects.toThrow(/ENCRYPTION_KEY is not set/);
  });

  it('still constructs (with a warned dev fallback) when ENCRYPTION_KEY is unset outside production', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'encryptionKey') return undefined;
        if (key === 'nodeEnv') return 'development';
        return undefined;
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    const devService = module.get(EncryptionService);
    const ciphertext = devService.encrypt('fallback-key-round-trip');
    expect(devService.decrypt(ciphertext)).toBe('fallback-key-round-trip');
  });
});
