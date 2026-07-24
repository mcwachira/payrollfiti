import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentProviderType } from '@prisma/client';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeProvider } from './providers/stripe.provider';
import { MpesaProvider } from './providers/mpesa.provider';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('BillingService', () => {
  let service: BillingService;
  let prisma: any;
  let stripeProvider: any;
  let mpesaProvider: any;

  const plan = {
    id: 'plan-1',
    code: 'STARTER',
    pricePerEmployee: 500,
    currency: 'KES',
    isActive: true,
  };
  const tenant = { id: 'tenant-1', name: 'Acme' };
  const adminUser = { id: 'user-1', email: 'admin@acme.co.ke' };
  const subscription = {
    id: 'sub-1',
    tenantId: 'tenant-1',
    planId: plan.id,
    plan,
    provider: PaymentProviderType.STRIPE,
    providerCustomerId: 'cus_123',
  };

  beforeEach(async () => {
    prisma = {
      plan: { findUnique: asyncMock(plan), findMany: asyncMock([plan]) },
      tenant: { findUniqueOrThrow: asyncMock(tenant) },
      user: { findFirst: asyncMock(adminUser) },
      employee: { count: asyncMock(4) },
      subscription: {
        upsert: asyncMock({ id: 'sub-1', ...subscription }),
        findUnique: asyncMock(subscription),
        findUniqueOrThrow: asyncMock(subscription),
      },
      usageRecord: {
        upsert: asyncMock({
          tenantId: 'tenant-1',
          period: '2026-07',
          employeeCount: 4,
        }),
      },
      invoice: {
        create: asyncMock({ id: 'invoice-1', amount: 2000 }),
        findUnique: asyncMock(null),
        update: asyncMock({ id: 'invoice-1', status: InvoiceStatus.PAID }),
      },
      paymentTransaction: { create: asyncMock({ id: 'txn-1' }) },
    };
    stripeProvider = {
      type: PaymentProviderType.STRIPE,
      createCustomer: asyncMock('cus_123'),
      createSubscription: asyncMock({
        providerSubscriptionId: 'sub_stripe_1',
        currentPeriodStart: new Date('2026-07-01'),
        currentPeriodEnd: new Date('2026-08-01'),
      }),
      charge: asyncMock({
        providerReference: 'ch_123',
        status: 'succeeded',
        raw: {},
      }),
    };
    mpesaProvider = {
      type: PaymentProviderType.MPESA,
      createCustomer: asyncMock('mpesa-cust-1'),
      createSubscription: asyncMock({
        providerSubscriptionId: 'mpesa_sub_1',
        currentPeriodStart: new Date('2026-07-01'),
        currentPeriodEnd: new Date('2026-08-01'),
      }),
      charge: asyncMock({
        providerReference: 'mpesa_ref_1',
        status: 'pending',
        raw: {},
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeProvider, useValue: stripeProvider },
        { provide: MpesaProvider, useValue: mpesaProvider },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  describe('subscribe', () => {
    it('subscribes via the default Stripe provider', async () => {
      const result = await service.subscribe('tenant-1', {
        planCode: 'STARTER',
      });

      expect(stripeProvider.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Acme',
          email: 'admin@acme.co.ke',
        }),
      );
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          create: expect.objectContaining({
            provider: PaymentProviderType.STRIPE,
          }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 'sub-1' }));
    });

    it('throws NotFoundException for an unknown plan code', async () => {
      prisma.plan.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.subscribe('tenant-1', { planCode: 'BOGUS' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('routes to the MPESA provider when requested', async () => {
      await service.subscribe('tenant-1', {
        planCode: 'STARTER',
        provider: PaymentProviderType.MPESA,
      });

      expect(mpesaProvider.createCustomer).toHaveBeenCalledTimes(1);
      expect(stripeProvider.createCustomer).not.toHaveBeenCalled();
    });
  });

  describe('generateInvoice', () => {
    it('computes the invoice amount as round2(employeeCount * pricePerEmployee)', async () => {
      await service.generateInvoice('tenant-1', '2026-07');

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            amount: 2000, // 4 employees * 500 pricePerEmployee
            currency: 'KES',
            status: InvoiceStatus.OPEN,
          }),
        }),
      );
    });

    it('throws NotFoundException when the tenant has no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.generateInvoice('tenant-1', '2026-07'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('payInvoice', () => {
    const invoice = {
      id: 'invoice-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      amount: 2000,
      currency: 'KES',
      provider: PaymentProviderType.STRIPE,
    };

    it('marks the invoice PAID on a successful charge', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(invoice);

      const result = await service.payInvoice('tenant-1', 'invoice-1', {});

      expect(stripeProvider.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000,
          currency: 'KES',
          reference: 'invoice-1',
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'invoice-1' },
          data: expect.objectContaining({ status: InvoiceStatus.PAID }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ status: 'succeeded' }));
    });

    it('throws NotFoundException for a cross-tenant invoice even though the row exists', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce({
        ...invoice,
        tenantId: 'other-tenant',
      });

      await expect(
        service.payInvoice('tenant-1', 'invoice-1', {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('does not mark the invoice PAID when the provider status is not succeeded/paid', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(invoice);
      stripeProvider.charge.mockResolvedValueOnce({
        providerReference: 'ch_pending',
        status: 'pending',
        raw: {},
      });

      await service.payInvoice('tenant-1', 'invoice-1', {});

      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('routes the charge through the MPESA provider when the invoice provider is MPESA', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce({
        ...invoice,
        provider: PaymentProviderType.MPESA,
      });

      await service.payInvoice('tenant-1', 'invoice-1', {
        phoneNumber: '254700000000',
      });

      expect(mpesaProvider.charge).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber: '254700000000' }),
      );
      expect(stripeProvider.charge).not.toHaveBeenCalled();
    });
  });

  describe('listPlans', () => {
    it('returns only active plans', async () => {
      const result = await service.listPlans();

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toEqual([plan]);
    });
  });
});
