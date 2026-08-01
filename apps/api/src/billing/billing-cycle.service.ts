import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/**
 * Runs at 06:00 on the 1st of every month and generates an invoice for
 * every ACTIVE subscription that hasn't already been billed for the
 * current period. TRIALING/PAST_DUE/CANCELED subscriptions are skipped —
 * trials aren't charged, and a subscription already past due or canceled
 * shouldn't silently accumulate more invoices.
 *
 * Idempotency is derived from the UsageRecord (tenantId, period) unique
 * key that generateInvoice() writes to via recordUsage() — the same guard
 * billing.service.ts already relies on internally, so this can safely run
 * more than once for the same period without double-invoicing.
 */
@Injectable()
export class BillingCycleService {
  private readonly logger = new Logger(BillingCycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  @Cron('0 6 1 * *')
  async runBillingCycle(): Promise<void> {
    const period = currentPeriod();
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    for (const subscription of subscriptions) {
      try {
        const alreadyBilled = await this.prisma.usageRecord.findUnique({
          where: {
            tenantId_period: { tenantId: subscription.tenantId, period },
          },
        });
        if (alreadyBilled) continue;

        await this.billingService.generateInvoice(
          subscription.tenantId,
          period,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate invoice for tenant ${subscription.tenantId}, period ${period}`,
          error as Error,
        );
      }
    }
  }
}
