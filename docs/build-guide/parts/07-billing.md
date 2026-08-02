# Part 7 — Billing & Payments

## 7.1 Schema Recap & Provider Abstraction

Billing rests on four models from Part 2 §2.3 Cluster 6: `Plan` (per-country pricing catalog), `Subscription`, `Invoice`, `UsageRecord` (employee-count snapshots), and `PaymentTransaction` (raw provider-attempt log independent of `Invoice.status`).

Every payment provider — Paystack today, M-Pesa today, anything added later — implements one interface, so `BillingService` never branches on which provider a tenant picked:

```typescript
// billing/providers/payment-provider.interface.ts
export interface ChargeParams {
  amount: number; currency: string; reference: string;
  customerId?: string;
  phoneNumber?: string; // required by phone-based providers like M-Pesa
  email?: string;       // required by hosted-checkout providers like Paystack
}

export interface ChargeResult { providerReference: string; status: string; raw: unknown; }

export interface PaymentProvider {
  readonly type: PaymentProviderType;
  createCustomer(customer: ProviderCustomer): Promise<string>;
  createSubscription(params: { customerId: string; planPricePerEmployee: number; currency: string; quantity: number }): Promise<ProviderSubscriptionResult>;
  charge(params: ChargeParams): Promise<ChargeResult>;
}
```

```typescript
// billing.service.ts
private getProvider(type: PaymentProviderType): PaymentProvider {
  return type === PaymentProviderType.MPESA ? this.mpesaProvider : this.paystackProvider;
}
```

## 7.2 Paystack Provider

Paystack subscriptions need an existing card authorization (obtained from a prior successful transaction) that doesn't exist yet at signup time, so `createSubscription` just books a local billing period the same way M-Pesa does — actual collection happens per-invoice via `charge()`, which initializes a hosted-checkout transaction and returns a reference; confirmation arrives later, asynchronously, via webhook:

```typescript
// billing/providers/paystack.provider.ts
@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly type = PaymentProviderType.PAYSTACK;

  async charge(params: ChargeParams): Promise<ChargeResult> {
    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set — simulating a successful charge');
      return { providerReference: `stub_paystack_${params.reference}`, status: 'succeeded', raw: null };
    }
    if (!params.email) throw new Error('Paystack charge requires an email');

    const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      email: params.email,
      amount: Math.round(params.amount * 100), // Paystack expects amounts in the smallest currency unit (kobo/cents)
      currency: params.currency, reference: params.reference,
      callback_url: `${this.callbackBaseUrl}/billing`,
    }, { headers: this.authHeaders() });

    return { providerReference: response.data.data.reference, status: 'pending', raw: response.data.data };
  }
}
```

**Config-gated dev stub**: every provider checks its own credentials before making a real API call and returns a deterministic stub result when unconfigured — this is what lets the entire billing flow (subscribe → invoice → pay → webhook confirm) be exercised end-to-end in local dev and CI with zero real payment credentials, while still exercising the exact same code path a production deployment uses.

## 7.3 M-Pesa (Daraja) Provider — STK Push

M-Pesa has no customer object (the phone number supplied at charge time *is* the identity) and no native recurring-subscription concept, so `charge()` is where the real integration work is: obtaining an OAuth token, building the Lipa Na M-Pesa password, and triggering an STK push prompt on the payer's phone.

```typescript
// billing/providers/mpesa.provider.ts
async charge(params: ChargeParams): Promise<ChargeResult> {
  const mpesaConfig = this.configService.get('mpesa', { infer: true });
  if (!mpesaConfig.consumerKey || !mpesaConfig.consumerSecret || !mpesaConfig.shortcode || !mpesaConfig.passkey) {
    this.logger.warn('M-Pesa credentials not configured — simulating a successful STK push');
    return { providerReference: `stub_mpesa_${params.reference}`, status: 'pending', raw: null };
  }
  if (!params.phoneNumber) throw new Error('M-Pesa charge requires a phoneNumber');

  const accessToken = await this.getAccessToken(mpesaConfig.consumerKey, mpesaConfig.consumerSecret);
  const timestamp = this.formatTimestamp(new Date()); // yyyyMMddHHmmss
  const password = Buffer.from(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`).toString('base64');

  // Safaricom does not sign STK push callbacks, so a shared-secret token is
  // embedded in the callback URL itself to reject spoofed requests.
  const callbackUrl = mpesaConfig.callbackToken
    ? `${mpesaConfig.callbackUrl}?token=${encodeURIComponent(mpesaConfig.callbackToken)}`
    : mpesaConfig.callbackUrl;

  const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    BusinessShortCode: mpesaConfig.shortcode, Password: password, Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline', Amount: Math.round(params.amount),
    PartyA: params.phoneNumber, PartyB: mpesaConfig.shortcode, PhoneNumber: params.phoneNumber,
    CallBackURL: callbackUrl, AccountReference: params.reference, TransactionDesc: params.reference,
  }, { headers: { Authorization: `Bearer ${accessToken}` } });

  return { providerReference: response.data.CheckoutRequestID, status: response.data.ResponseCode === '0' ? 'pending' : 'failed', raw: response.data };
}

private async getAccessToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${credentials}` } });
  return response.data.access_token;
}
```

## 7.4 Webhook Verification — Signed vs. Unsigned

The two providers deliver payment confirmation completely differently, and the webhook controller handles each on its own terms rather than forcing a shared abstraction where none exists.

**Paystack** signs the webhook body with HMAC-SHA512 over the *exact raw bytes* — which is exactly why `main.ts` enables `rawBody: true` (Part 4 §4.2). Verification uses a constant-time comparison to avoid a timing side-channel:

```typescript
// billing/payment-webhooks.controller.ts
@Public()
@Post('paystack')
@HttpCode(200)
async paystack(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature: string | undefined) {
  const secretKey = this.configService.get('paystack', { infer: true }).secretKey;
  if (!secretKey || !req.rawBody) return { received: false };

  const expectedSignature = crypto.createHmac('sha512', secretKey).update(req.rawBody).digest('hex');
  if (!signature || !this.timingSafeEqualHex(signature, expectedSignature)) {
    this.logger.warn('Paystack webhook signature verification failed');
    return { received: false };
  }

  const event = JSON.parse(req.rawBody.toString('utf8'));
  const reference: string | undefined = event?.data?.reference;
  if (event.event === 'charge.success') {
    await this.billingService.confirmInvoicePaidByTransactionReference(PaymentProviderType.PAYSTACK, reference);
  } else if (event.event === 'charge.failed') {
    await this.billingService.recordTransactionFailure(PaymentProviderType.PAYSTACK, reference);
  }
  return { received: true };
}

private timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex'), bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```

**M-Pesa** doesn't sign STK push callbacks at all, so the system embeds its own shared-secret token as a query parameter on the callback URL it registers with Safaricom, and checks that token on the way in instead:

```typescript
@Public()
@Post('mpesa')
@HttpCode(200)
async mpesa(@Body() body: MpesaStkCallback, @Query('token') token: string | undefined) {
  const expectedToken = this.configService.get('mpesa', { infer: true }).callbackToken;
  if (expectedToken && token !== expectedToken) {
    // Safaricom only cares that we ack with ResultCode 0 — a mismatched
    // token means we simply drop the payload rather than process it.
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
  const callback = body?.Body?.stkCallback;
  if (callback?.CheckoutRequestID) {
    if (callback.ResultCode === 0) {
      await this.billingService.confirmInvoicePaidByTransactionReference(PaymentProviderType.MPESA, callback.CheckoutRequestID);
    } else {
      await this.billingService.recordTransactionFailure(PaymentProviderType.MPESA, callback.CheckoutRequestID);
    }
  }
  return { ResultCode: 0, ResultDesc: 'Accepted' };
}
```

Both webhook endpoints are decorated `@Public()` (bypassing the global `JwtAuthGuard`) since the caller is Paystack's or Safaricom's servers, not an authenticated user — their own signature/token check is the actual authorization boundary here.

## 7.5 The Payment Flow, End to End

```typescript
// billing.service.ts
async payInvoice(tenantId: string, invoiceId: string, dto: PayInvoiceDto) {
  const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.tenantId !== tenantId) throw new NotFoundException('Invoice not found');

  const provider = this.getProvider(invoice.provider);
  const result = await provider.charge({
    amount: invoice.amount, currency: invoice.currency, reference: invoice.id,
    phoneNumber: dto.phoneNumber, email: adminUser?.email,
  });

  // The provider.charge() HTTP call happens BEFORE the transaction starts —
  // an external call must never hold a DB transaction open. But the
  // resulting PaymentTransaction row and the conditional Invoice update
  // must commit together, or a crash between them could leave a
  // transaction recorded 'succeeded' against an invoice stuck OPEN forever.
  const chargeSucceeded = await this.prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      invoiceId: invoice.id, provider: invoice.provider, reference: result.providerReference,
      amount: invoice.amount, currency: invoice.currency, status: result.status, rawResponse: result.raw,
    });
    // Paystack and real M-Pesa only ever return 'pending' here — actual
    // confirmation arrives later via the webhook. 'succeeded' only happens
    // synchronously for the unconfigured-provider dev stub.
    if (result.status === 'succeeded' || result.status === 'paid') {
      await this.markInvoicePaidTx(tx, invoice, result.providerReference);
      return true;
    }
    return false;
  });

  if (chargeSucceeded) await this.dispatchInvoicePaidSideEffects(tenantId, invoice);
  return result;
}

/** Called from both webhook handlers once a 'pending' charge actually completes. */
async confirmInvoicePaidByTransactionReference(provider: PaymentProviderType, transactionReference: string) {
  const transaction = await this.prisma.paymentTransaction.findFirst({ where: { provider, reference: transactionReference }, orderBy: { createdAt: 'desc' } });
  if (!transaction) return null;
  const invoice = await this.prisma.invoice.findUnique({ where: { id: transaction.invoiceId } });
  if (!invoice || invoice.status === InvoiceStatus.PAID) return invoice; // already handled — idempotent

  await this.prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'succeeded' } });
    await this.markInvoicePaidTx(tx, invoice, transactionReference);
  });
  await this.dispatchInvoicePaidSideEffects(invoice.tenantId, invoice);
  return invoice;
}
```

The `chargeSucceeded`/side-effects split is deliberate: webhook dispatch and accounting sync are best-effort — wrapped in `.catch(() => {})` — and run only *after* the payment-state transaction has already committed, so a downstream integration failure can never roll back a real, already-confirmed payment.

## 7.6 Automated Monthly Billing Cycle

A cron job (`@nestjs/schedule`) runs on the 1st of every month and generates one invoice per `ACTIVE` subscription — `TRIALING`/`PAST_DUE`/`CANCELED` subscriptions are skipped:

```typescript
// billing/billing-cycle.service.ts
@Injectable()
export class BillingCycleService {
  @Cron('0 6 1 * *') // 06:00 on the 1st of every month
  async runBillingCycle(): Promise<void> {
    const period = currentPeriod(); // "YYYY-MM"
    const subscriptions = await this.prisma.subscription.findMany({ where: { status: SubscriptionStatus.ACTIVE } });

    for (const subscription of subscriptions) {
      try {
        const alreadyBilled = await this.prisma.usageRecord.findUnique({
          where: { tenantId_period: { tenantId: subscription.tenantId, period } },
        });
        if (alreadyBilled) continue; // idempotency guard — safe to re-run the whole cycle for the same period
        await this.billingService.generateInvoice(subscription.tenantId, period);
      } catch (error) {
        this.logger.error(`Failed to generate invoice for tenant ${subscription.tenantId}, period ${period}`, error as Error);
      }
    }
  }
}
```

Idempotency here rides on the same `UsageRecord (tenantId, period)` unique constraint that `generateInvoice()` writes to via `recordUsage()` internally — the cron job doesn't need its own separate dedup mechanism, and a single tenant's invoicing failure (caught and logged inside the loop) never aborts the rest of the cycle for every other tenant.

**Plan and currency safety**: `subscribe()` refuses to attach a tenant to a plan priced for a different country (`plan.countryCode !== tenant.countryCode`) — the same single-currency-per-tenant invariant from Part 2 applied to billing, so a Kenyan tenant can never end up billed in Nigerian-priced Naira by a UI bug.
