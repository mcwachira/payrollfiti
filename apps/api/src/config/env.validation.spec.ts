import { validateEnv } from './env.validation';

function baseEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('passes through a valid development config unchanged', () => {
    const env = baseEnv();
    expect(validateEnv(env)).toBe(env);
  });

  it('throws when DATABASE_URL is missing', () => {
    const env = { NODE_ENV: 'development' };
    expect(() => validateEnv(env)).toThrow(/Invalid environment configuration/);
  });

  it('throws for an unrecognized NODE_ENV', () => {
    expect(() => validateEnv(baseEnv({ NODE_ENV: 'staging-typo' }))).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('allows development to boot without any secrets configured', () => {
    expect(() => validateEnv(baseEnv())).not.toThrow();
  });

  describe('in production', () => {
    const prodEnv = (overrides: Record<string, unknown> = {}) =>
      baseEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a-real-production-secret-value',
        JWT_REFRESH_SECRET: 'another-real-production-secret',
        ENCRYPTION_KEY: '0'.repeat(64),
        ...overrides,
      });

    it('boots when all production secrets are properly configured', () => {
      expect(() => validateEnv(prodEnv())).not.toThrow();
    });

    it('refuses to boot when JWT_ACCESS_SECRET is missing', () => {
      expect(() =>
        validateEnv(prodEnv({ JWT_ACCESS_SECRET: undefined })),
      ).toThrow(/JWT_ACCESS_SECRET must be set in production/);
    });

    it('refuses to boot when JWT_ACCESS_SECRET is still the checked-in dev default', () => {
      expect(() =>
        validateEnv(
          prodEnv({ JWT_ACCESS_SECRET: 'dev-access-secret-change-me' }),
        ),
      ).toThrow(/checked-in development default/);
    });

    it('refuses to boot when JWT_REFRESH_SECRET is still the checked-in dev default', () => {
      expect(() =>
        validateEnv(
          prodEnv({ JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me' }),
        ),
      ).toThrow(/checked-in development default/);
    });

    it('refuses to boot when a secret is too short', () => {
      expect(() =>
        validateEnv(prodEnv({ JWT_ACCESS_SECRET: 'short' })),
      ).toThrow(/too short/);
    });

    it('refuses to boot when ENCRYPTION_KEY is missing', () => {
      expect(() =>
        validateEnv(prodEnv({ ENCRYPTION_KEY: undefined })),
      ).toThrow(/ENCRYPTION_KEY must be set in production/);
    });

    it('reports every problem at once rather than failing on the first', () => {
      expect(() =>
        validateEnv(
          prodEnv({
            JWT_ACCESS_SECRET: undefined,
            JWT_REFRESH_SECRET: undefined,
            ENCRYPTION_KEY: undefined,
          }),
        ),
      ).toThrow(
        /JWT_ACCESS_SECRET must be set in production[\s\S]*JWT_REFRESH_SECRET must be set in production[\s\S]*ENCRYPTION_KEY must be set in production/,
      );
    });
  });
});
