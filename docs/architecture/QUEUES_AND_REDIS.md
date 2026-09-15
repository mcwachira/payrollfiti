# PayrollFiti — Queues, Redis & Messaging (Part 13)

> Deep-dive reference for the asynchronous messaging layer: queue topology, Horizon,
> the transactional outbox, event fan-out, tenant-aware jobs, webhook delivery, and
> the gotchas that shape how it is tested and run.

## 1. Stack

- **Driver**: Laravel Queues on **Redis** (`QUEUE_CONNECTION=redis` in prod; `sync` in
  tests).
- **Monitor**: Laravel Horizon (`php artisan horizon`; dashboard gated by the
  `viewHorizon` Gate).
- **Redis surface**: the same Redis instance backs queues, cache, sessions, locks,
  rate limits and Horizon metadata, keyed under the `payrollfiti_queue_` prefix.
- **Deferred dispatch**: `config/queue.php` sets `redis.after_commit => true` — jobs
  dispatched inside a DB transaction are not handed to the queue until the
  transaction commits (enforced by Laravel's `RedisQueue` after-commit guard).

## 2. Queue topology

One queue per concern so a slow consumer can never starve a fast one.

| Queue         | Purpose                                                        | Supervisor         | Tries | Backoff / timeout             |
| ------------- | -------------------------------------------------------------- | ------------------ | ----- | ----------------------------- |
| `high`        | 2FA codes, password resets                                     | supervisor-default | 3     | 120s timeout                  |
| `default`     | general-purpose, low volume                                    | supervisor-default | 3     | 120s                          |
| `payroll`     | payslip generation fan-out                                     | supervisor-payroll | 3     | 120s                          |
| `notifications` | in-app notification writes                                   | supervisor-default | 3     | 120s                          |
| `email`       | outbound email                                                 | supervisor-email   | 5     | `[10, 60, 300]`, 120s         |
| `sms`         | outbound SMS                                                   | supervisor-email   | 5     | `[10, 60, 300]`, 120s         |
| `webhooks`    | outbound webhook delivery **and** inbound provider events      | supervisor-webhooks| 6     | `[5,30,120,600,3600,21600]` (≈6h), 60s |
| `reports`     | compliance report generation                                   | supervisor-default | 3     | 120s                          |
| `exports`     | bulk data exports                                               | supervisor-default | 3     | 120s                          |
| `integrations`| accounting-platform sync (OAuth-bound, rate-limited)           | supervisor-integrations | 5 | `[30,120,600,3600]`, 240s    |

Supervisors use `balance => auto` (`autoScalingStrategy: time` on the default
supervisor) so idle capacity on e.g. `sms`/`exports` is redirected to `payroll`
under end-of-month burst load. `minProcesses`/`maxProcesses` cap each supervisor
(2–10 default, 2–20 payroll, 1–8 webhooks, 1–4 integrations).

## 3. The transactional outbox

Two irreversible "money" events are published via an outbox so that a crash between
state change and broadcast can never lose them:

```
finalize payroll run / settle payment
   │  DB transaction
   ├─ mutate aggregate state          (run → finalized; transaction → succeeded)
   ├─ INSERT outbox_events row        (same transaction: atomic with state)
   └─ commit
⇒ queue:dispatch-outbox (scheduler, every 5s, non-test envs)
   ├─ CLAIMS pending rows FOR UPDATE (exclusive; `lockForUpdate`)
   ├─ maps event_type → domain event, event(event)
   ├─ stamps dispatched_at, increments attempts
   └─ a poisoned row fails softly: last_error is recorded, neighbours proceed
```

- `App\Domain\Messaging\OutboxDispatcher` — claim + publish, 500-row batch limit.
- `outbox_events` columns: `tenant_id`, `event_type`, `aggregate_type`,
  `aggregate_id`, `payload` (jsonb), `available_at`, `dispatched_at`, `attempts`,
  `last_error` + timestamps.
- Event-type mapping is a `match` in `publish()`; an unmapped type **throws**, so it
  dead-letters with `attempts`/`last_error` instead of being silently dropped.
- Writes: `FinalizePayrollRun` and the payment settlement service both create the
  outbox row inside the same DB transaction as the state change.

### Fired events & fan-out

`App\Providers\EventServiceProvider::$listen` (explicit — discovery is disabled):

| Event | Listeners (queue) |
| --- | --- |
| `PayrollRunCompleted` | `GeneratePayslips` (payroll), `SendPayrollCompletionNotifications` (notifications), `DispatchOutboundWebhooks` (webhooks), `SyncPayrollToAccounting` (integrations) |
| `PaymentSettled` | `DispatchOutboundWebhooks` (webhooks) |

All four listeners are `ShouldQueue` + `public $queue`, `$tries`, `$timeout`
properties (they must **not** use `Queueable`/`InteractsWithQueue`/`SerializesModels`
on the listener class — only `ShouldQueue` — or queue routing breaks).

Events are positional-argument based: `PayrollRunCompleted(string $tenantId,
string $payrollRunId, array $payload = [])` and `PaymentSettled(string $tenantId,
string $paymentTransactionId, array $payload = [])`.

> **Registrations gotcha**: `bootstrap/app.php` uses `->withEvents(discover: false)`
> while `EventServiceProvider` is registered explicitly in `withProviders`. Adding the
> provider **both** ways (or leaving `discover` on) registers every listener twice and
> doubles every queue push. Listener discovery by `handle()` signature is fragile with
> union-typed handlers (e.g. `DispatchOutboundWebhooks` listens to two events), so the
> explicit `$listen` map is the source of truth.

## 4. Jobs

Base: `App\Jobs\TenantAwareJob` — `Queueable`, `InteractsWithQueue`,
`SerializesModels`, `Batchable`, `WithoutOverlapping`-friendly; constructor calls
`$this->onQueue(...)`, sets `$this->timeout`/`$this->tries`; `handle()` sets
`TenantContext` from the first constructor argument and clears it in `finally`.

| Job | Queue | Notes |
| --- | --- | --- |
| `GeneratePayslip` | payroll | `ShouldBeUnique` (per tenant + entry), `WithoutOverlapping($this->payrollEntryId)` middleware; renders the payslip to the `payslips` disk and creates the `Payslip` DB row idempotently. |
| `DeliverWebhook` | webhooks | HMAC-SHA256 signature over the JSON payload; writes `WebhookDeliveryLog(sent)`; `maxTries`/retry via supervisor backoff. |
| `ProcessPaymentWebhook` | webhooks | Inbound provider payload → array-safe decode → settlement. |
| `SyncAccountingConnection` | integrations | Dedup on `accounting_sync_jobs.filters->entity_id`; skips tenants without a connection as `pending` (not `failed`). |

Listener `GeneratePayslips` fans one completed run out into **one job per payroll
entry** (`chunkById(100)`), skipping entries that already have a `Payslip`, so a
re-dispatch after a queue hiccup is idempotent.

## 5. Scheduling (`routes/console.php`)

| Command | Trigger |
| --- | --- |
| `queue:dispatch-outbox` | every 5 seconds (`when` env ≠ testing) |
| `payments:reconcile-pending` | every 15 minutes |
| `billing:process-subscription-renewals` | daily 02:00, `onOneServer` |

## 6. Redis usage beyond queues

Same Redis instance: cache (array in tests), sessions, locks + rate limits, queue
delay/retry keys, and Horizon metadata (metrics/waits under the Horizon prefix).

## 7. Testing the messaging layer

`tests/Feature/QueueMessagingTest.php` (14 tests, manual minimal schema — not
`RefreshDatabase`) covers: queue config after-commit, Horizon topology, the outbox
command + schedule registration, finalize→outbox atomicity + idempotency, the relay
fan-out to dedicated queues, the per-entry payslip fan-out with skip-idempotency,
tenant-context cleanup, payslip persistence, webhook signing/delivery logging +
retry-failure, accounting-sync skip-vs-failed, and payment-settlement outbox
rollback.

Laravel framework behaviors the tests had to account for:

1. **Queued listeners** land in the fake under `Illuminate\Events\CallQueuedListener`
   — assert with `Queue::listenersPushed(Listener::class)` / `Queue::size('queue')`,
   not `assertPushed(Listener::class)`.
2. **`Queue::fake()` swaps in a brand-new empty fake each call** — never call it
   again to "inspect"; hold the instance from the start.
3. **Unique-lock delivery gate**: `PendingDispatch::__destruct()` runs
   `shouldDispatch()`, which acquires a `UniqueLock` (cache) at dispatch time for
   `ShouldBeUnique` jobs and **skips the dispatch when the lock is held**. With a
   faked queue the job never runs and the lock never releases — re-dispatching the
   same unique job silently becomes a no-op (`UniqueJobSkipped`). In tests, release
   per-entry locks with `(new \Illuminate\Bus\UniqueLock(Cache::store()))->release(
   new Job(...))` **before** re-dispatching.
4. **jsonb + array where**: `where('filters', ['entity_id' => ...])` is treated as a
   WHERE-IN of scalars and Postgres rejects the UUID/json cast. Use JSON-path
   comparison `where('filters->entity_id', $value)`.
5. **after_commit=true**: jobs dispatched inside a DB transaction (e.g. inside the
   outbox relay) are only released to the queue after commit — a super-important
   property, and why `QueueMessagingTest::redis_queue_connection_is_after_commit`
   locks the config.

## 8. Running in prod

```
php artisan horizon                    # or supervisord -> php artisan horizon
php artisan schedule:work               # on a single dedicated scheduler node
php artisan queue:dispatch-outbox       # manual drain / on-demand
HORIZON_PATH=<secret>                   # obscure the dashboard path
```

Deploy with `horizon:terminate` + `horizon:continue` around releases so in-flight
jobs finish and queued jobs are republished (see `fast_termination`). Monitor the
Horizon dashboard for long waits (`waits` thresholds: payroll 120s, webhooks 30s,
integrations 120s) and act on the `failed` jobs table.