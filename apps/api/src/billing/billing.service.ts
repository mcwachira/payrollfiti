import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentProviderType,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { round2 } from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';
import { StripeProvider } from './providers/stripe.provider';
import { MpesaProvider } from './providers/mpesa.provider';
import { PaymentProvider } from './providers/payment-provider.interface';
import { SubscribeDto } from './dto/subscribe.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  ACCOUNTING_PROVIDER,
  AccountingProvider,
} from '../accounting/accounting-provider.interface';

const INVOICE_DUE_DAYS = 14;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeProvider: StripeProvider,
    private readonly mpesaProvider: MpesaProvider,
    private readonly webhooksService: WebhooksService,
    @Inject(ACCOUNTING_PROVIDER)
    private readonly accountingProvider: AccountingProvider,
  ) {}

  private getProvider(type: PaymentProviderType): PaymentProvider {
    return type === PaymentProviderType.MPESA
      ? this.mpesaProvider
      : this.stripeProvider;
  }

  async subscribe(tenantId: string, dto: SubscribeDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    const adminUser = await this.prisma.user.findFirst({
      where: { tenantId, role: 'ADMIN' },
    });
    const providerType = dto.provider ?? PaymentProviderType.STRIPE;
    const provider = this.getProvider(providerType);

    const employeeCount = await this.countActiveEmployees(tenantId);
    const providerCustomerId = await provider.createCustomer({
      tenantId,
      name: tenant.name,
      email: adminUser?.email ?? '',
    });
    const providerSub = await provider.createSubscription({
      customerId: providerCustomerId,
      planPricePerEmployee: plan.pricePerEmployee,
      currency: plan.currency,
      quantity: Math.max(1, employeeCount),
    });

    return this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        provider: providerType,
        providerCustomerId,
        providerSubscriptionId: providerSub.providerSubscriptionId,
        currentPeriodStart: providerSub.currentPeriodStart,
        currentPeriodEnd: providerSub.currentPeriodEnd,
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        provider: providerType,
        providerCustomerId,
        providerSubscriptionId: providerSub.providerSubscriptionId,
        currentPeriodStart: providerSub.currentPeriodStart,
        currentPeriodEnd: providerSub.currentPeriodEnd,
      },
    });
  }

  getSubscription(tenantId: string) {
    return this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
  }

  listPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true } });
  }

  async recordUsage(tenantId: string, period: string) {
    const employeeCount = await this.countActiveEmployees(tenantId);
    return this.prisma.usageRecord.upsert({
      where: { tenantId_period: { tenantId, period } },
      create: { tenantId, period, employeeCount },
      update: { employeeCount },
    });
  }

  async generateInvoice(tenantId: string, period: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!subscription)
      throw new NotFoundException('Tenant has no active subscription');

    const usage = await this.recordUsage(tenantId, period);
    const amount = round2(
      usage.employeeCount * subscription.plan.pricePerEmployee,
    );

    return this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        amount,
        currency: subscription.plan.currency,
        status: InvoiceStatus.OPEN,
        dueDate: new Date(Date.now() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000),
        provider: subscription.provider,
      },
    });
  }

  listInvoices(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async payInvoice(tenantId: string, invoiceId: string, dto: PayInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Invoice not found');
    }
    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: invoice.subscriptionId },
    });
    const provider = this.getProvider(invoice.provider);

    const result = await provider.charge({
      amount: invoice.amount,
      currency: invoice.currency,
      reference: invoice.id,
      customerId: subscription.providerCustomerId ?? undefined,
      phoneNumber: dto.phoneNumber,
    });

    await this.prisma.paymentTransaction.create({
      data: {
        invoiceId: invoice.id,
        provider: invoice.provider,
        reference: result.providerReference,
        amount: invoice.amount,
        currency: invoice.currency,
        status: result.status,
        rawResponse: (result.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    if (result.status === 'succeeded' || result.status === 'paid') {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: new Date(),
          providerInvoiceId: result.providerReference,
        },
      });

      // Best-effort side effects of a paid invoice — neither may fail the
      // already-committed payment response.
      void this.webhooksService
        .dispatch(tenantId, 'invoice.paid', {
          invoiceId: invoice.id,
          amount: invoice.amount,
          currency: invoice.currency,
        })
        .catch(() => {});

      await this.accountingProvider
        .syncInvoice({
          id: invoice.id,
          tenantId,
          amount: invoice.amount,
          currency: invoice.currency,
          status: InvoiceStatus.PAID,
        })
        .catch(() => {});
    }

    return result;
  }

  private countActiveEmployees(tenantId: string): Promise<number> {
    return this.prisma.employee.count({
      where: { status: 'ACTIVE', company: { tenantId } },
    });
  }
}
