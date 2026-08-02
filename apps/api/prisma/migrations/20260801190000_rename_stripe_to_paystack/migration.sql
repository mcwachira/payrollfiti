-- Rename the STRIPE payment provider enum value to PAYSTACK. Using
-- RENAME VALUE (rather than a drop/add pair) preserves existing rows that
-- already reference it (Subscription.provider, Invoice.provider,
-- PaymentTransaction.provider) instead of failing on rows still in use.
ALTER TYPE "PaymentProviderType" RENAME VALUE 'STRIPE' TO 'PAYSTACK';

ALTER TABLE "Subscription" ALTER COLUMN "provider" SET DEFAULT 'PAYSTACK';
ALTER TABLE "Invoice" ALTER COLUMN "provider" SET DEFAULT 'PAYSTACK';
