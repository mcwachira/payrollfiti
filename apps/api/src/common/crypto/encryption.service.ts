import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AppConfig } from '../../config/configuration';

// Dev-only fallback key — 32 bytes of zero, hex-encoded. Mirrors the
// dev-secret-fallback pattern used for JWT secrets in configuration.ts.
// MUST be overridden via ENCRYPTION_KEY in any non-development environment,
// otherwise every deployment would share the same key and ciphertext would
// be trivially decryptable by anyone who has read this source file.
const DEV_FALLBACK_KEY = '0'.repeat(64);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const CIPHERTEXT_FORMAT = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

/**
 * Field-level encryption for sensitive PII (KRA PIN, NSSF/NHIF numbers, bank
 * account numbers). Explicit encrypt/decrypt calls in the owning services —
 * not a Prisma middleware — matching the fact this codebase has no
 * `$use`/`$extends` usage anywhere else.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;
  private warnedAboutFallback = false;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const configuredKey = this.configService.get('encryptionKey', {
      infer: true,
    });
    const nodeEnv = this.configService.get('nodeEnv', { infer: true });

    // Fail closed: a production deploy must never silently fall back to the
    // well-known zero key. Refusing to boot is safer than encrypting PII
    // with a key anyone who has read this source file can reconstruct.
    if (!configuredKey && nodeEnv === 'production') {
      throw new Error(
        'ENCRYPTION_KEY is not set. Refusing to start in production without ' +
          'a real encryption key — set a 64-hex-character ENCRYPTION_KEY.',
      );
    }

    this.key = Buffer.from(configuredKey || DEV_FALLBACK_KEY, 'hex');
  }

  private warnIfUsingFallback(): void {
    if (this.warnedAboutFallback) return;
    const configuredKey = this.configService.get('encryptionKey', {
      infer: true,
    });
    if (!configuredKey) {
      this.logger.warn(
        'ENCRYPTION_KEY not set — using an insecure dev fallback key. ' +
          'This MUST be overridden in production.',
      );
      this.warnedAboutFallback = true;
    }
  }

  encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;
    this.warnIfUsingFallback();

    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  decrypt(ciphertext: string | null | undefined): string | null {
    if (!ciphertext) return null;
    this.warnIfUsingFallback();

    if (!CIPHERTEXT_FORMAT.test(ciphertext)) {
      throw new InternalServerErrorException(
        'Unrecognized ciphertext format — value may be legacy plaintext ' +
          'that predates encryption, or corrupt data',
      );
    }

    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(authTagHex!, 'hex');
    const encrypted = Buffer.from(encryptedHex!, 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
