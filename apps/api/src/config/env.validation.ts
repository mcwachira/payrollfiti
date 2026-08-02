import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  @IsOptional()
  NODE_ENV?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  ENCRYPTION_KEY?: string;
}

/** Dev-only fallback secrets — see configuration.ts and encryption.service.ts. */
const INSECURE_DEFAULT_SECRETS = new Set([
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
  'change-me-access-secret',
  'change-me-refresh-secret',
]);

const MIN_SECRET_LENGTH = 16;

/**
 * Wired into ConfigModule.forRoot({ validate }) so the app refuses to boot
 * — instead of silently running with a broken or insecure configuration —
 * as soon as env vars are loaded, before any module (and its DB/Redis
 * connections) initializes. Covers two failure modes the rest of the
 * codebase otherwise had no single gate for: required vars simply missing,
 * and production booting with the same well-known dev secrets checked into
 * this repo's .env.example / docs.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }

  const nodeEnv = validated.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    const problems: string[] = [];

    for (const [key, value] of [
      ['JWT_ACCESS_SECRET', validated.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', validated.JWT_REFRESH_SECRET],
    ] as const) {
      if (!value) {
        problems.push(`${key} must be set in production`);
      } else if (INSECURE_DEFAULT_SECRETS.has(value)) {
        problems.push(
          `${key} is still set to the checked-in development default`,
        );
      } else if (value.length < MIN_SECRET_LENGTH) {
        problems.push(
          `${key} is too short (must be at least ${MIN_SECRET_LENGTH} characters)`,
        );
      }
    }

    if (!validated.ENCRYPTION_KEY) {
      problems.push(
        'ENCRYPTION_KEY must be set in production (field-level PII encryption would otherwise use a well-known dev-only key)',
      );
    }

    if (problems.length > 0) {
      throw new Error(
        `Refusing to start in production with insecure configuration:\n- ${problems.join(
          '\n- ',
        )}`,
      );
    }
  }

  return config;
}
