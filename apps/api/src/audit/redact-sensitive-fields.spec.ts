import { describe, it, expect } from '@jest/globals';
import { redactSensitiveFields } from './redact-sensitive-fields';

describe('redactSensitiveFields', () => {
  it('redacts a raw API key, matching the shape ApiKeysService.create returns', () => {
    const input = {
      apiKey: { id: 'key-1', name: 'Test', hashedKey: 'abc123' },
      rawKey: 'pfk_super-secret-value',
    };

    expect(redactSensitiveFields(input)).toEqual({
      apiKey: { id: 'key-1', name: 'Test', hashedKey: '[REDACTED]' },
      rawKey: '[REDACTED]',
    });
  });

  it('redacts a webhook signing secret', () => {
    const input = {
      id: 'wh-1',
      url: 'https://example.com',
      secret: 'whsec_abc',
    };

    expect(redactSensitiveFields(input)).toEqual({
      id: 'wh-1',
      url: 'https://example.com',
      secret: '[REDACTED]',
    });
  });

  it('redacts password and token fields regardless of case', () => {
    const input = {
      passwordHash: 'bcrypt-hash',
      accessToken: 'jwt-access',
      refreshToken: 'jwt-refresh',
      TOKEN: 'raw-token',
    };

    expect(redactSensitiveFields(input)).toEqual({
      passwordHash: '[REDACTED]',
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      TOKEN: '[REDACTED]',
    });
  });

  it('redacts nested and array values without touching unrelated fields', () => {
    const input = {
      user: { email: 'a@b.com', passwordHash: 'hash' },
      items: [{ secret: 'one' }, { secret: 'two' }],
    };

    expect(redactSensitiveFields(input)).toEqual({
      user: { email: 'a@b.com', passwordHash: '[REDACTED]' },
      items: [{ secret: '[REDACTED]' }, { secret: '[REDACTED]' }],
    });
  });

  it('passes through null/undefined/primitives unchanged', () => {
    expect(redactSensitiveFields(null)).toBeNull();
    expect(redactSensitiveFields(undefined)).toBeUndefined();
    expect(redactSensitiveFields('plain string')).toBe('plain string');
    expect(redactSensitiveFields(42)).toBe(42);
  });

  it('leaves fields that only loosely resemble sensitive names alone', () => {
    const input = { tokenized: 'not actually a secret field' };
    // "tokenized" contains "token" but isn't exactly "token" and isn't
    // one of the other patterns — deliberately not redacted, since an
    // overly broad substring match would start eating unrelated fields
    // like "tokenExpiryDisplay".
    expect(redactSensitiveFields(input)).toEqual(input);
  });
});
