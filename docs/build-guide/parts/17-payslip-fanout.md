# Part 17 — Payslip Delivery at Scale

Part 8 built the notification queue's general shape: write the in-app row, enqueue a BullMQ job for the out-of-band channels, let a processor pick it up off the request thread. Payslip emails followed that shape too — but with one structural difference that this part corrects: everything for a payroll run was one job, not one job per payslip.

## 17.1 One Job Per Run Was the Wrong Grain

`PayrollService.run()` (Part 5) enqueues payslip delivery right after a run completes, so rendering and emailing a payslip per employee doesn't add request latency proportional to headcount:

```typescript
// payroll/payroll.service.ts
// Enqueued (one BullMQ job per entry) rather than run inline — rendering +
// emailing a payslip per employee would otherwise add request latency
// proportional to headcount. PayslipEmailsProcessor picks these up off the
// request thread, concurrently; enqueueForRun itself never throws.
await this.payslipEmailService.enqueueForRun(tenantId, run.id);
```

The queue side of that used to add a single `deliver-for-run` job carrying just `{ tenantId, payrollRunId }`. The processor's `process()` then looped over every entry in the run *inside that one job's execution*:

```typescript
// notifications/payslip-emails.processor.ts — the old shape
async process(job: Job<PayslipEmailsJobData>): Promise<void> {
  const { tenantId, payrollRunId } = job.data;
  await this.payslipEmailService.sendPayslipEmailsForRun(tenantId, payrollRunId); // looped internally
}
```

Two problems fall out of that grain. First, BullMQ's concurrency and retry both operate at the *job* level — with the whole run as one job, a company with 200 employees processes all 200 payslips strictly sequentially inside a single worker slot, no matter how much concurrency the worker is configured for. Second, and worse: `sendPayslipEmail()` caught its own errors internally and just logged them, on the reasoning that a failure "must never fail the payroll-run HTTP response that triggered it." That reasoning was correct for the *old* call site — `enqueueForRun`, awaited synchronously in the request path — but the loop inside the queued job inherited the same never-throw behavior for no reason, which meant BullMQ never saw a failure to retry. One employee's mail provider hiccup was silently swallowed, with no automatic second attempt, for that employee only — invisible unless someone went looking at logs.

## 17.2 Splitting the Job, Splitting the Guarantee

The fix changes the unit of work from "a run" to "a payslip," and — just as importantly — separates the two different never-throw guarantees that had been conflated into one function:

```typescript
// notifications/payslip-emails.queue.ts
export const PAYSLIP_EMAILS_QUEUE = 'payslip-emails';
export const PAYSLIP_EMAILS_DELIVER_JOB = 'deliver-for-entry';

export interface PayslipEmailsJobData {
  tenantId: string;
  payrollEntryId: string;
}
```

```typescript
// notifications/payslip-email.service.ts
/**
 * Enqueues one job per entry in the run — one job per entry (rather than
 * one job looping over the whole run) lets BullMQ process a run's emails
 * concurrently and retry a single failed entry without resending everyone
 * else's payslip.
 *
 * This method itself must never throw — a failure here must never fail
 * the payroll-run HTTP response that triggered it.
 */
async enqueueForRun(tenantId: string, payrollRunId: string): Promise<void> {
  try {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId }, include: { entries: true } });
    if (!run) return;

    await this.payslipEmailsQueue.addBulk(
      run.entries.map((entry) => ({
        name: PAYSLIP_EMAILS_DELIVER_JOB,
        data: { tenantId, payrollEntryId: entry.id },
      })),
    );
  } catch (error) {
    this.logger.error(`Failed to enqueue payslip emails for run ${payrollRunId}`, error as Error);
  }
}

/**
 * Called only by PayslipEmailsProcessor, one entry per job — lets errors
 * propagate so BullMQ retries just this entry, instead of swallowing them
 * the way enqueueForRun above must.
 */
async sendPayslipEmail(tenantId: string, payrollEntryId: string): Promise<void> {
  const entry = await this.prisma.payrollEntry.findUnique({
    where: { id: payrollEntryId },
    include: { employee: { include: { user: true, company: true } }, payrollRun: true },
  });
  if (!entry || entry.employee.company.tenantId !== tenantId) return;

  const email = entry.employee.user?.email;
  if (!email) return; // no linked login — nowhere to send a payslip email

  const buffer = await this.payslipsService.generate(tenantId, payrollEntryId);
  await this.mailService.sendMail(
    email,
    `Your Payslip — ${entry.payrollRun.period}`,
    `<p>Hi ${entry.employee.firstName},</p><p>Your payslip for ${entry.payrollRun.period} is attached.</p>`,
    [{ filename: 'payslip.pdf', content: buffer }],
  );
}
```

`enqueueForRun` keeps its try/catch because it's still awaited directly in the request path. `sendPayslipEmail` drops its try/catch entirely, because it's no longer called from anywhere except the processor — letting the error surface is what makes it BullMQ's problem to retry, instead of a silently-swallowed one-off failure. The processor shrinks to a straight pass-through, now running with real concurrency:

```typescript
// notifications/payslip-emails.processor.ts
@Processor(PAYSLIP_EMAILS_QUEUE, { concurrency: 5 })
export class PayslipEmailsProcessor extends WorkerHost {
  async process(job: Job<PayslipEmailsJobData>): Promise<void> {
    const { tenantId, payrollEntryId } = job.data;
    await this.payslipEmailService.sendPayslipEmail(tenantId, payrollEntryId);
  }
}
```

Letting an error through only matters if something is configured to catch it and retry — no queue in this codebase had ever set `attempts` above BullMQ's default of 1, which is a silent no-op retry policy easy to miss since nothing errors when it's absent. The payslip-emails queue gets one explicitly, since this is now the one queue whose processor is designed around per-job retry:

```typescript
// notifications/notifications.module.ts
BullModule.registerQueue(
  { name: NOTIFICATIONS_QUEUE },
  {
    name: PAYSLIP_EMAILS_QUEUE,
    // sendPayslipEmail() now throws on failure instead of swallowing it
    // specifically so a transient failure — mail provider hiccup, PDF
    // render error — gets retried instead of silently dropping that one
    // employee's payslip.
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  },
),
```

Verified live against the running dev server rather than only through mocks: added two jobs directly onto the real `payslip-emails` queue, each for a different payroll entry in a different tenant, and confirmed via BullMQ's own job-state API that both completed independently through the real processor — `sendPayslipEmail` → the real Prisma lookup → a real mail send — rather than one shared job either succeeding or failing as a unit.

```
$ npx ts-node check-fanout.ts
7 completed {"tenantId":"demo-tenant","payrollEntryId":"ba30f50b-..."}
8 completed {"tenantId":"9c7847bd-...","payrollEntryId":"3514c870-..."}
```

That closes the six-feature arc this part and the two before it cover: developer self-service that's actually auditable (Part 15), a login that's actually hardened against both a stolen password and a stale token (Part 16), and now a payroll run whose email delivery scales with headcount instead of against it, with failures isolated and retried per employee instead of silently dropped for the whole batch. Part 18 closes out two remaining gaps from earlier in the build: the notification bell's frontend half, and the accounting-sync integration Part 7 only ever mentioned in passing.
