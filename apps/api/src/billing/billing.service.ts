import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentProviderType,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { round2 } from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';
import { PaystackProvider } from './providers/paystack.provider';
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
const DEFAULT_PLAN_COUNTRY = 'KE';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystackProvider: PaystackProvider,
    private readonly mpesaProvider: MpesaProvider,
    private readonly webhooksService: WebhooksService,
    @Inject(ACCOUNTING_PROVIDER)
    private readonly accountingProvider: AccountingProvider,
  ) {}

  private getProvider(type: PaymentProviderType): PaymentProvider {
    return type === PaymentProviderType.MPESA
      ? this.mpesaProvider
      : this.paystackProvider;
  }

  async subscribe(tenantId: string, dto: SubscribeDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    // A plan with a countryCode is priced in that country's currency;
    // subscribing a tenant to a plan priced for a different country would
    // silently bill them in the wrong currency. Legacy plans with no
    // countryCode (pre-dating per-country pricing) are unrestricted.
    if (plan.countryCode && plan.countryCode !== tenant.countryCode) {
      throw new BadRequestException(
        `Plan "${plan.code}" is priced for ${plan.countryCode}, but this tenant's country is ${tenant.countryCode}`,
      );
    }
    const adminUser = await this.prisma.user.findFirst({
      where: { tenantId, role: 'ADMIN' },
    });
    const providerType = dto.provider ?? PaymentProviderType.PAYSTACK;
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

  /**
   * Without a tenantId, returns the full active plan catalog (used
   * internally). With one, scopes to plans priced for that tenant's
   * country, falling back to the default country's plans if none exist yet
   * for it — mirrors @repo/pricing's getPricingForCountry fallback so the
   * billing page never shows an empty plan list.
   */
  async listPlans(tenantId?: string) {
    if (!tenantId) {
      return this.prisma.plan.findMany({ where: { isActive: true } });
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    const countryPlans = await this.prisma.plan.findMany({
      where: { isActive: true, countryCode: tenant.countryCode },
    });
    if (countryPlans.length > 0) return countryPlans;

    return this.prisma.plan.findMany({
      where: { isActive: true, countryCode: DEFAULT_PLAN_COUNTRY },
    });
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
    const adminUser = await this.prisma.user.findFirst({
      where: { tenantId, role: 'ADMIN' },
    });

    const result = await provider.charge({
      amount: invoice.amount,
      currency: invoice.currency,
      reference: invoice.id,
      customerId: subscription.providerCustomerId ?? undefined,
      phoneNumber: dto.phoneNumber,
      email: adminUser?.email,
    });

    // paymentTransaction.create and the conditional invoice.update below
    // must commit together: if the process died between the two writes,
    // a transaction could be recorded 'succeeded' against an invoice that
    // stays OPEN forever. The provider.charge() call itself happens before
    // the transaction starts, since it's an external HTTP call that must
    // not hold a DB transaction open.
    const chargeSucceeded = await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          invoiceId: invoice.id,
          provider: invoice.provider,
          reference: result.providerReference,
          amount: invoice.amount,
          currency: invoice.currency,
          status: result.status,
          rawResponse: (result.raw ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });

      // Paystack and (real, non-stub) M-Pesa charges only ever return
      // 'pending' here — actual confirmation arrives asynchronously via
      // confirmInvoicePaidByTransactionReference below, triggered by the
      // provider's webhook/callback. 'succeeded'/'paid' only happens
      // synchronously for the unconfigured-provider dev stub.
      if (result.status === 'succeeded' || result.status === 'paid') {
        await this.markInvoicePaidTx(tx, invoice, result.providerReference);
        return true;
      }
      return false;
    });

    if (chargeSucceeded) {
      await this.dispatchInvoicePaidSideEffects(tenantId, invoice);
    }

    return result;
  }

  /**
   * Called from the Paystack webhook (`charge.success`) and the M-Pesa STK
   * push callback once a charge that started as 'pending' actually
   * completes. `transactionReference` is whatever PaymentTransaction.reference
   * was set to for that charge: the invoice id for Paystack (its own
   * `reference` echoed back), or the CheckoutRequestID for M-Pesa.
   */
  async confirmInvoicePaidByTransactionReference(
    provider: PaymentProviderType,
    transactionReference: string,
  ) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { provider, reference: transactionReference },
      orderBy: { createdAt: 'desc' },
    });
    if (!transaction) return null;

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: transaction.invoiceId },
    });
    if (!invoice || invoice.status === InvoiceStatus.PAID) return invoice;

    // Both writes must commit together, or a crash in between leaves the
    // transaction marked 'succeeded' against an invoice that never gets
    // marked PAID.
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'succeeded' },
      });
      await this.markInvoicePaidTx(tx, invoice, transactionReference);
    });

    await this.dispatchInvoicePaidSideEffects(invoice.tenantId, invoice);
    return invoice;
  }

  async recordTransactionFailure(
    provider: PaymentProviderType,
    transactionReference: string,
  ) {
    await this.prisma.paymentTransaction.updateMany({
      where: { provider, reference: transactionReference },
      data: { status: 'failed' },
    });
  }

  private markInvoicePaidTx(
    tx: Prisma.TransactionClient,
    invoice: { id: string },
    providerReference: string,
  ) {
    return tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        providerInvoiceId: providerReference,
      },
    });
  }

  /**
   * Best-effort side effects of a paid invoice, run after the payment
   * confirmation transaction has committed — neither may fail or roll back
   * the already-committed payment state.
   */
  private async dispatchInvoicePaidSideEffects(
    tenantId: string,
    invoice: { id: string; amount: number; currency: string },
  ) {
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

  private countActiveEmployees(tenantId: string): Promise<number> {
    return this.prisma.employee.count({
      where: { status: 'ACTIVE', company: { tenantId } },
    });
  }
}
