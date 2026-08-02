import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentProviderType } from '@prisma/client';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaystackProvider } from './providers/paystack.provider';
import { MpesaProvider } from './providers/mpesa.provider';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ACCOUNTING_PROVIDER } from '../accounting/accounting-provider.interface';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('BillingService', () => {
  let service: BillingService;
  let prisma: any;
  let paystackProvider: any;
  let mpesaProvider: any;
  let webhooksService: any;
  let accountingProvider: any;

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
    provider: PaymentProviderType.PAYSTACK,
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
      paymentTransaction: {
        create: asyncMock({ id: 'txn-1' }),
        findFirst: asyncMock(null),
        update: asyncMock({ id: 'txn-1', status: 'succeeded' }),
        updateMany: asyncMock({ count: 1 }),
      },
    };
    // Mock $transaction by just invoking the callback with the same mock
    // client — the individual model mocks above are what tests assert on.
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    paystackProvider = {
      type: PaymentProviderType.PAYSTACK,
      createCustomer: asyncMock('cus_123'),
      createSubscription: asyncMock({
        providerSubscriptionId: 'paystack-manual-1',
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

    webhooksService = { dispatch: asyncMock(undefined) };
    accountingProvider = {
      name: 'noop',
      syncInvoice: asyncMock({ success: true }),
      syncPayrollExpense: asyncMock({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaystackProvider, useValue: paystackProvider },
        { provide: MpesaProvider, useValue: mpesaProvider },
        { provide: WebhooksService, useValue: webhooksService },
        { provide: ACCOUNTING_PROVIDER, useValue: accountingProvider },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  describe('subscribe', () => {
    it('subscribes via the default Paystack provider', async () => {
      const result = await service.subscribe('tenant-1', {
        planCode: 'STARTER',
      });

      expect(paystackProvider.createCustomer).toHaveBeenCalledWith(
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
            provider: PaymentProviderType.PAYSTACK,
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
      expect(paystackProvider.createCustomer).not.toHaveBeenCalled();
    });

    it('rejects subscribing to a plan priced for a different country', async () => {
      prisma.plan.findUnique.mockResolvedValueOnce({
        ...plan,
        countryCode: 'NG',
      });
      prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        ...tenant,
        countryCode: 'KE',
      });

      await expect(
        service.subscribe('tenant-1', { planCode: 'STARTER' }),
      ).rejects.toThrow(BadRequestException);
      expect(paystackProvider.createCustomer).not.toHaveBeenCalled();
    });

    it('allows subscribing to a country-matched plan', async () => {
      prisma.plan.findUnique.mockResolvedValueOnce({
        ...plan,
        countryCode: 'KE',
      });
      prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        ...tenant,
        countryCode: 'KE',
      });

      await expect(
        service.subscribe('tenant-1', { planCode: 'STARTER' }),
      ).resolves.toEqual(expect.objectContaining({ id: 'sub-1' }));
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
      provider: PaymentProviderType.PAYSTACK,
    };

    it('passes the tenant admin email to the provider charge (required by Paystack)', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(invoice);

      await service.payInvoice('tenant-1', 'invoice-1', {});

      expect(paystackProvider.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000,
          currency: 'KES',
          reference: 'invoice-1',
          email: 'admin@acme.co.ke',
        }),
      );
    });

    it('marks the invoice PAID immediately when the provider charge succeeds synchronously (dev-stub fallback)', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(invoice);

      const result = await service.payInvoice('tenant-1', 'invoice-1', {});

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'invoice-1' },
          data: expect.objectContaining({ status: InvoiceStatus.PAID }),
        }),
      );
      expect(result).toEqual(expect.objectContaining({ status: 'succeeded' }));
    });

    it('dispatches an invoice.paid webhook and syncs to the accounting provider on a successful charge', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(invoice);

      await service.payInvoice('tenant-1', 'invoice-1', {});

      expect(webhooksService.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        'invoice.paid',
        expect.objectContaining({ invoiceId: 'invoice-1', amount: 2000 }),
      );
      expect(accountingProvider.syncInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invoice-1',
          tenantId: 'tenant-1',
          amount: 2000,
          status: InvoiceStatus.PAID,
        }),
      );
    });

    it('leaves the invoice OPEN when a real charge returns pending (awaiting webhook confirmation)', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(invoice);
      paystackProvider.charge.mockResolvedValueOnce({
        providerReference: 'invoice-1',
        status: 'pending',
        raw: { authorization_url: 'https://checkout.paystack.com/abc' },
      });

      await service.payInvoice('tenant-1', 'invoice-1', {});

      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(webhooksService.dispatch).not.toHaveBeenCalled();
      expect(accountingProvider.syncInvoice).not.toHaveBeenCalled();
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
      expect(paystackProvider.charge).not.toHaveBeenCalled();
    });
  });

  describe('confirmInvoicePaidByTransactionReference', () => {
    const transaction = {
      id: 'txn-1',
      invoiceId: 'invoice-1',
      provider: PaymentProviderType.PAYSTACK,
      reference: 'invoice-1',
    };
    const openInvoice = {
      id: 'invoice-1',
      tenantId: 'tenant-1',
      amount: 2000,
      currency: 'KES',
      status: InvoiceStatus.OPEN,
    };

    it('marks the invoice PAID and dispatches side effects when a matching pending transaction is found', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValueOnce(transaction);
      prisma.invoice.findUnique.mockResolvedValueOnce(openInvoice);

      await service.confirmInvoicePaidByTransactionReference(
        PaymentProviderType.PAYSTACK,
        'invoice-1',
      );

      expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'txn-1' },
          data: { status: 'succeeded' },
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'invoice-1' },
          data: expect.objectContaining({ status: InvoiceStatus.PAID }),
        }),
      );
      expect(webhooksService.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        'invoice.paid',
        expect.objectContaining({ invoiceId: 'invoice-1' }),
      );
    });

    it('runs both writes inside a single $transaction so they commit or fail together', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValueOnce(transaction);
      prisma.invoice.findUnique.mockResolvedValueOnce(openInvoice);

      await service.confirmInvoicePaidByTransactionReference(
        PaymentProviderType.PAYSTACK,
        'invoice-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txCallOrder =
        prisma.paymentTransaction.update.mock.invocationCallOrder[0];
      const invoiceCallOrder =
        prisma.invoice.update.mock.invocationCallOrder[0];
      const transactionCallOrder =
        prisma.$transaction.mock.invocationCallOrder[0];
      // Both writes must happen inside the $transaction call, not before it.
      expect(txCallOrder).toBeGreaterThan(transactionCallOrder);
      expect(invoiceCallOrder).toBeGreaterThan(transactionCallOrder);
    });

    it('does not mark the invoice PAID if the transaction status update throws (atomic rollback)', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValueOnce(transaction);
      prisma.invoice.findUnique.mockResolvedValueOnce(openInvoice);
      prisma.paymentTransaction.update.mockRejectedValueOnce(
        new Error('db write failed'),
      );

      await expect(
        service.confirmInvoicePaidByTransactionReference(
          PaymentProviderType.PAYSTACK,
          'invoice-1',
        ),
      ).rejects.toThrow('db write failed');

      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(webhooksService.dispatch).not.toHaveBeenCalled();
    });

    it('is a no-op when no transaction matches the reference', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValueOnce(null);

      const result = await service.confirmInvoicePaidByTransactionReference(
        PaymentProviderType.MPESA,
        'unknown-checkout-id',
      );

      expect(result).toBeNull();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('is idempotent — does nothing if the invoice is already PAID', async () => {
      prisma.paymentTransaction.findFirst.mockResolvedValueOnce(transaction);
      prisma.invoice.findUnique.mockResolvedValueOnce({
        ...openInvoice,
        status: InvoiceStatus.PAID,
      });

      await service.confirmInvoicePaidByTransactionReference(
        PaymentProviderType.PAYSTACK,
        'invoice-1',
      );

      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(webhooksService.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('recordTransactionFailure', () => {
    it('marks the matching transaction as failed', async () => {
      await service.recordTransactionFailure(
        PaymentProviderType.MPESA,
        'checkout-id-1',
      );

      expect(prisma.paymentTransaction.updateMany).toHaveBeenCalledWith({
        where: {
          provider: PaymentProviderType.MPESA,
          reference: 'checkout-id-1',
        },
        data: { status: 'failed' },
      });
    });
  });

  describe('listPlans', () => {
    it('returns only active plans when called with no tenantId', async () => {
      const result = await service.listPlans();

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toEqual([plan]);
    });

    it('scopes plans to the tenant country when a tenantId is given', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        ...tenant,
        countryCode: 'NG',
      });
      const ngPlan = {
        ...plan,
        code: 'ng-starter',
        countryCode: 'NG',
        currency: 'NGN',
      };
      prisma.plan.findMany.mockResolvedValueOnce([ngPlan]);

      const result = await service.listPlans('tenant-1');

      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true, countryCode: 'NG' },
      });
      expect(result).toEqual([ngPlan]);
    });

    it('falls back to the default country plans when none exist for the tenant country', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        ...tenant,
        countryCode: 'ZW',
      });
      prisma.plan.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([plan]);

      const result = await service.listPlans('tenant-1');

      expect(prisma.plan.findMany).toHaveBeenNthCalledWith(1, {
        where: { isActive: true, countryCode: 'ZW' },
      });
      expect(prisma.plan.findMany).toHaveBeenNthCalledWith(2, {
        where: { isActive: true, countryCode: 'KE' },
      });
      expect(result).toEqual([plan]);
    });
  });
});
