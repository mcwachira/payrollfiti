// One-off backfill script — encrypts any plaintext Employee PII
// (kraPin/nssfNumber/nhifNumber/bankAccountNumber) left over from before
// field-level encryption was introduced (Batch C).
//
// MUST be run ONCE after this batch's deploy, before or immediately after
// the app starts serving traffic with the new encrypt-on-write code, against
// any database that already has Employee rows — including the demo/seed
// data from prisma/seed.ts, whose KRA/NSSF/NHIF/bank values are plaintext
// until this script runs.
//
// Run via: pnpm --filter api run db:backfill-encrypt-pii
// (equivalent to: ts-node --transpile-only prisma/backfill-encrypt-pii.ts)
//
// Idempotent: values already in the `iv:tag:cipher` hex format are left
// untouched, so re-running this script after it has already succeeded is a
// harmless no-op.

import { createCipheriv, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEV_FALLBACK_KEY = '0'.repeat(64);
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const CIPHERTEXT_FORMAT = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

const key = Buffer.from(process.env.ENCRYPTION_KEY || DEV_FALLBACK_KEY, 'hex');

// Mirrors EncryptionService.encrypt exactly — kept as a standalone function
// here rather than importing the Nest service, since this script runs
// outside the Nest DI container.
function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

const PII_FIELDS = [
  'kraPin',
  'nssfNumber',
  'nhifNumber',
  'taxIdNumber',
  'pensionNumber',
  'bankAccountNumber',
] as const;

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn(
      'ENCRYPTION_KEY not set — encrypting with the insecure dev fallback key. ' +
        'Re-run this script against production with ENCRYPTION_KEY set to the real key.',
    );
  }

  const employees = await prisma.employee.findMany();
  console.log(`Scanning ${employees.length} employee(s) for plaintext PII...`);

  let updatedCount = 0;
  for (const employee of employees) {
    const updates: Record<string, string> = {};

    for (const field of PII_FIELDS) {
      const value = employee[field];
      if (value && !CIPHERTEXT_FORMAT.test(value)) {
        updates[field] = encrypt(value);
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: updates,
      });
      updatedCount += 1;
      console.log(
        `  Encrypted ${Object.keys(updates).join(', ')} for employee ${employee.id}`,
      );
    }
  }

  console.log(
    `Backfill complete: ${updatedCount}/${employees.length} employee(s) updated.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
