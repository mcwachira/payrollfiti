# Part 8 — Notifications & Background Jobs

## 8.1 Two Independent Queues, One Reason: Keep the Request Thread Free

Two BullMQ queues exist in this system, and they exist for the same underlying reason — never let per-employee or per-channel fan-out work add latency to the HTTP request that triggered it:

1. **`notifications` queue** — fans a single logical notification out to email/SMS/push channels.
2. **`payslip-emails` queue** — renders and emails a payslip PDF for every entry in a just-completed payroll run.

Both follow the identical shape: a `*Service` writes synchronously what must be immediately consistent (an in-app `Notification` row; nothing, in the payslip case), then enqueues a job for everything that can happen asynchronously, and a `*Processor` (`WorkerHost`) consumes it off the request thread with BullMQ's built-in retry.

## 8.2 In-App Notifications + Multi-Channel Fan-Out

`NotificationsService` has two tiers of method: `create`/`createForRoles` write only the in-app row; `dispatch`/`dispatchForRoles` do that *and* enqueue out-of-band delivery.

```typescript
// notifications/notifications.service.ts
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationDeliverJobData>,
  ) {}

  /** Best-effort, never-throw, logged — a notification failing to write must never break the request that triggered it. */
  async create(tenantId: string, userId: string, type: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.notification.create({ data: { tenantId, userId, type, message, metadata } });
    } catch (error) {
      this.logger.error(`Failed to create notification (${type}) for user ${userId}`, error as Error);
    }
  }

  async dispatch(tenantId: string, userId: string, type: string, message: string, options?: DispatchOptions): Promise<void> {
    await this.create(tenantId, userId, type, message, options?.metadata);
    await this.enqueueDelivery(tenantId, userId, type, message, options);
  }

  private async enqueueDelivery(tenantId: string, userId: string, type: string, message: string, options?: DispatchOptions): Promise<void> {
    try {
      await this.queue.add(NOTIFICATION_DELIVER_JOB, {
        tenantId, userId, type, message, metadata: options?.metadata,
        channels: options?.channels ?? [NotificationChannel.EMAIL],
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue notification delivery (${type}) for user ${userId}`, error as Error);
    }
  }
}
```

Every method here is wrapped in try/catch-and-log rather than letting an error propagate — this is a deliberate, repeated pattern across the whole notifications layer (mirrored in `MailService.sendMail`, `PayslipEmailService.sendPayslipEmail`, and `AuditService.record`): **side-effect services that run as a consequence of a primary action must never be able to fail that primary action.** A payroll run that completed successfully stays completed even if the email provider is down.

The processor consumes the job and fans out to whichever channels were requested:

```typescript
// notifications/notifications.processor.ts
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  async process(job: Job<NotificationDeliverJobData>): Promise<void> {
    const { userId, type, message, metadata, channels } = job.data;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const rendered = renderNotificationTemplate(type, message, metadata);
    for (const channel of channels) {
      switch (channel) {
        case NotificationChannel.EMAIL:
          await this.mailService.sendMail(user.email, rendered.subject, rendered.html);
          break;
        case NotificationChannel.SMS:
          if (!user.phone) { this.logger.warn(`Skipping SMS for user ${userId}: no phone on file`); break; }
          await this.smsProvider.send(user.phone, rendered.sms);
          break;
        case NotificationChannel.PUSH:
          await this.pushProvider.send(userId, rendered.subject, rendered.sms);
          break;
      }
    }
  }
}
```

`SmsProvider` and `PushProvider` are both injected via interface tokens (`SMS_PROVIDER`, `PUSH_PROVIDER`), letting `notifications.module.ts` swap in a no-op implementation when unconfigured — the same config-gated pattern as the payment providers (Part 7 §7.2).

## 8.3 Mail Service

A thin, direct wrapper around `nodemailer` — deliberately not `@nestjs-modules/mailer` — mirroring the "wrap the SDK directly" pattern used for Paystack/M-Pesa:

```typescript
// notifications/mail.service.ts
@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const smtp = this.configService.get('smtp', { infer: true });
      this.transporter = nodemailer.createTransport({
        host: smtp.host, port: smtp.port,
        auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
      });
    }
    return this.transporter;
  }

  async sendMail(to: string, subject: string, html: string, attachments?: MailAttachment[]): Promise<void> {
    try {
      const smtp = this.configService.get('smtp', { infer: true });
      await this.getTransporter().sendMail({ from: smtp.from, to, subject, html, attachments });
    } catch (error) {
      this.logger.error(`Failed to send mail to ${to}: ${subject}`, error as Error);
    }
  }
}
```

## 8.4 SMS — Africa's Talking

Real HTTP integration, config-gated exactly like the payment providers — inert until `AFRICAS_TALKING_API_KEY`/`AFRICAS_TALKING_USERNAME` are set, at which point a factory in `notifications.module.ts` selects it over a `NoopSmsProvider`:

```typescript
// notifications/providers/africas-talking-sms.provider.ts
@Injectable()
export class AfricasTalkingSmsProvider implements SmsProvider {
  async send(to: string, message: string): Promise<SmsSendResult> {
    const config = this.configService.get('africasTalking', { infer: true });
    if (!config.apiKey || !config.username) {
      return { success: false, error: 'SMS provider not configured' };
    }

    const body = new URLSearchParams({ username: config.username, to, message, ...(config.senderId ? { from: config.senderId } : {}) });
    const response = await axios.post<AfricasTalkingResponse>(API_URL, body, {
      headers: { apiKey: config.apiKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    });

    const recipient = response.data.SMSMessageData?.Recipients?.[0];
    return recipient?.status === 'Success' ? { success: true } : { success: false, error: recipient?.status };
  }
}
```

## 8.5 Payslip Email — Bulk Dispatch Off the Payroll-Run Thread

This is the direct counterpart, in Part 5's payroll run, to §8.1's general principle. `PayrollService.executeRun` enqueues rather than sends inline:

```typescript
// notifications/payslip-email.service.ts
@Injectable()
export class PayslipEmailService {
  /** Call this from request-handling code — enqueues, doesn't send. */
  async enqueueForRun(tenantId: string, payrollRunId: string): Promise<void> {
    await this.payslipEmailsQueue.add(PAYSLIP_EMAILS_DELIVER_JOB, { tenantId, payrollRunId });
  }

  /** Never throws. Called by the queue processor, not directly from request-handling code. */
  async sendPayslipEmailsForRun(tenantId: string, payrollRunId: string): Promise<void> {
    try {
      const run = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId }, include: { entries: true } });
      if (!run) return;
      for (const entry of run.entries) {
        await this.sendPayslipEmail(tenantId, entry.id); // sequential + awaited — see note below
      }
    } catch (error) {
      this.logger.error(`Failed to send payslip emails for run ${payrollRunId}`, error as Error);
    }
  }

  async sendPayslipEmail(tenantId: string, payrollEntryId: string): Promise<void> {
    try {
      const entry = await this.prisma.payrollEntry.findUnique({
        where: { id: payrollEntryId }, include: { employee: { include: { user: true, company: true } }, payrollRun: true },
      });
      if (!entry || entry.employee.company.tenantId !== tenantId) return;
      const email = entry.employee.user?.email;
      if (!email) return; // employee has no linked login — nowhere to send a payslip email

      const buffer = await this.payslipsService.generate(tenantId, payrollEntryId); // reuses Part 5's PDF renderer directly
      await this.mailService.sendMail(email, `Your Payslip — ${entry.payrollRun.period}`, `<p>Hi ${entry.employee.firstName},</p>...`, [{ filename: 'payslip.pdf', content: buffer }]);
    } catch (error) {
      this.logger.error(`Failed to send payslip email for entry ${payrollEntryId}`, error as Error);
    }
  }
}
```

`sendPayslipEmailsForRun` loops sequentially and awaits each send — a known, documented tradeoff (adds latency proportional to headcount for very large companies) rather than a hidden one; a bounded-concurrency map (the same `mapWithConcurrency` pattern from Part 5 §5.2) is the natural upgrade path if that ever becomes a real bottleneck, but wasn't needed yet.

The processor is almost embarrassingly thin, because all the error handling already lives in the service method it calls:

```typescript
// notifications/payslip-emails.processor.ts
@Processor(PAYSLIP_EMAILS_QUEUE)
export class PayslipEmailsProcessor extends WorkerHost {
  async process(job: Job<PayslipEmailsJobData>): Promise<void> {
    const { tenantId, payrollRunId } = job.data;
    await this.payslipEmailService.sendPayslipEmailsForRun(tenantId, payrollRunId);
  }
}
```

## 8.6 Queue Registration

Each queue is registered with `BullModule.registerQueue({ name: ... })` inside its owning feature module (`notifications.module.ts`), on top of the root Redis connection configured once in `AppModule` (Part 4 §4.3):

```typescript
// app.module.ts
BullModule.forRootAsync({
  useFactory: (configService: ConfigService<AppConfig, true>) => ({
    connection: new Redis(configService.get('redisUrl', { infer: true }) ?? 'redis://localhost:6379', { maxRetriesPerRequest: null }),
  }),
  inject: [ConfigService],
}),
```

`maxRetriesPerRequest: null` is required by BullMQ's blocking-connection model — without it, ioredis's own retry limit fights with BullMQ's internal reconnect logic on a long-lived worker connection.
