import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import { BillingCycleService } from './billing-cycle.service';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('BillingCycleService', () => {
  let service: BillingCycleService;
  let prisma: any;
  let billingService: any;

  const activeSubscription = {
    id: 'sub-1',
    tenantId: 'tenant-1',
    status: SubscriptionStatus.ACTIVE,
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T06:00:00Z'));

    prisma = {
      subscription: {
        // Prisma's `where: { status: ACTIVE }` filter is applied by the
        // real DB — the mock simulates that by only ever returning the
        // active subscription fixture.
        findMany: asyncMock([activeSubscription]),
      },
      usageRecord: {
        findUnique: asyncMock(null),
      },
    };
    billingService = {
      generateInvoice: asyncMock({ id: 'invoice-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingCycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingService, useValue: billingService },
      ],
    }).compile();

    service = module.get(BillingCycleService);
  });

  it('generates an invoice for an active subscription not yet billed this period', async () => {
    await service.runBillingCycle();

    expect(prisma.usageRecord.findUnique).toHaveBeenCalledWith({
      where: { tenantId_period: { tenantId: 'tenant-1', period: '2026-08' } },
    });
    expect(billingService.generateInvoice).toHaveBeenCalledWith(
      'tenant-1',
      '2026-08',
    );
  });

  it('skips a subscription already billed for the current period', async () => {
    prisma.usageRecord.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      period: '2026-08',
      employeeCount: 5,
    });

    await service.runBillingCycle();

    expect(billingService.generateInvoice).not.toHaveBeenCalled();
  });

  it('continues billing remaining tenants if one invoice generation fails', async () => {
    prisma.subscription.findMany.mockResolvedValueOnce([
      activeSubscription,
      { id: 'sub-3', tenantId: 'tenant-3', status: SubscriptionStatus.ACTIVE },
    ]);
    billingService.generateInvoice
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce({ id: 'invoice-2' });

    await expect(service.runBillingCycle()).resolves.toBeUndefined();

    expect(billingService.generateInvoice).toHaveBeenCalledTimes(2);
  });

  it('only queries ACTIVE subscriptions, excluding TRIALING/PAST_DUE/CANCELED', async () => {
    await service.runBillingCycle();

    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: { status: SubscriptionStatus.ACTIVE },
    });
  });
});
