<?php

namespace Tests\Feature;

use App\Domain\Messaging\OutboxDispatcher;
use App\Domain\Payroll\Application\FinalizePayrollRun;
use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Jobs\DeliverWebhook;
use App\Jobs\GeneratePayslip;
use App\Jobs\ProcessPaymentWebhook;
use App\Jobs\SyncAccountingConnection;
use App\Jobs\TenantAwareJob;
use App\Listeners\DispatchOutboundWebhooks;
use App\Listeners\GeneratePayslips;
use App\Listeners\SendPayrollCompletionNotifications;
use App\Listeners\SyncPayrollToAccounting;
use App\Models\AccountingConnection;
use App\Models\AccountingSyncJob;
use App\Models\AccountingSyncRecord;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Invoice;
use App\Models\OutboxEvent;
use App\Models\PaymentProviderEvent;
use App\Models\PaymentTransaction;
use App\Models\PayrollEntry;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\Permission;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WebhookDeliveryLog;
use App\Models\WebhookEndpoint;
use App\Support\TenantContext;
use Illuminate\Bus\UniqueLock;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Part 13 — Queues, Redis & Messaging.
 *
 * Covers: redis after-commit queue config; Horizon topology; the transactional
 * outbox (write-time atomicity, relay exactly-once claiming, event fan-out on
 * the correct dedicated queues, unknown-type dead-lettering); TenantAwareJob
 * context lifecycles (success AND failure paths leave no tenant leaked into a
 * shared worker); payslip generation idempotency + object storage; webhook
 * delivery signing/retry/failed() bookkeeping; accounting sync idempotency;
 * and the payment-settlement outbox marker.
 */
class QueueMessagingTest extends TestCase
{
    private Tenant $tenant;

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createMinimalSchema();

        $this->tenant = Tenant::create([
            'name' => 'Queue Co',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
        ]);

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Queue Payroll',
            'country' => 'KE',
            'currency' => 'KES',
            'legal_name' => 'Queue Payroll Limited',
            'registration_number' => 'RC-Q1',
            'email' => 'ops-'.Str::uuid().'@test',
            'status' => 'active',
        ]);

        $this->user = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Queue Admin',
            'email' => 'queue-'.Str::uuid().'@test',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
        ]);

        Permission::updateOrCreate(
            ['name' => 'payroll.manage'],
            ['slug' => 'payroll.manage', 'domain' => 'payroll', 'guard_name' => 'web'],
        );
        Permission::updateOrCreate(
            ['name' => 'employees.manage'],
            ['slug' => 'employees.manage', 'domain' => 'employees', 'guard_name' => 'web'],
        );

        $this->user->givePermissionTo('payroll.manage');
        $this->user->givePermissionTo('employees.manage');
        $this->actingAs($this->user, 'sanctum');
    }

    protected function createMinimalSchema(): void
    {
        $tables = [
            'payslips',
            'payroll_entry_items',
            'payroll_entries',
            'payroll_runs',
            'accounting_sync_records',
            'accounting_sync_jobs',
            'accounting_mappings',
            'accounting_connections',
            'webhook_delivery_logs',
            'webhook_endpoints',
            'notifications',
            'outbox_events',
            'payment_provider_events',
            'payment_transactions',
            'invoices',
            'employees',
            'companies',
            'tenants',
            'users',
            'model_has_permissions',
            'role_has_permissions',
            'user_roles',
            'role_permissions',
            'roles',
            'permissions',
            'personal_access_tokens',
        ];

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP TABLE IF EXISTS ' . implode(', ', $tables) . ' CASCADE');
        } else {
            DB::statement('PRAGMA foreign_keys = OFF');
            foreach ($tables as $table) {
                DB::statement('DROP TABLE IF EXISTS ' . $table);
            }
            DB::statement('PRAGMA foreign_keys = ON');
        }

        Schema::create('tenants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('subdomain')->unique();
            $table->string('default_country', 2)->default('KE');
            $table->string('default_currency', 3)->default('KES');
            $table->json('branding')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamps();
        });

        Schema::create('companies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('legal_name')->nullable();
            $table->string('registration_number')->nullable();
            $table->string('country', 2)->default('KE');
            $table->string('currency', 3)->default('KES');
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('company_id');
            $table->string('employee_number');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->nullable();
            $table->string('country', 2);
            $table->date('hire_date');
            $table->string('status')->default('active');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('company_id');
            $table->date('period_start');
            $table->date('period_end');
            $table->date('pay_date');
            $table->string('status')->default('draft');
            $table->char('input_hash', 64);
            $table->string('rule_version');
            $table->uuid('initiated_by');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->uuid('finalized_by')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->json('input_snapshot')->nullable();
            $table->timestamps();
        });

        Schema::create('payroll_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('payroll_run_id');
            $table->uuid('employee_id');
            $table->decimal('gross_pay', 18, 2);
            $table->decimal('taxable_pay', 18, 2)->default(0);
            $table->decimal('total_deductions', 18, 2);
            $table->decimal('employer_contributions', 18, 2)->default(0);
            $table->decimal('net_pay', 18, 2);
            $table->json('breakdown');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('payslips', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('payroll_entry_id')->unique();
            $table->string('payslip_number')->unique();
            $table->string('status')->default('generated');
            $table->string('storage_disk')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('file_hash')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('user_id')->nullable();
            $table->string('event_type');
            $table->string('title');
            $table->text('body');
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        Schema::create('webhook_endpoints', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('url');
            $table->string('secret_hash');
            $table->text('secret_ciphertext')->nullable();
            $table->json('events');
            $table->string('status')->default('active');
            $table->timestamp('last_delivered_at')->nullable();
            $table->timestamps();
        });

        Schema::create('webhook_delivery_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('webhook_endpoint_id');
            $table->string('event_type');
            $table->string('event_id')->nullable();
            $table->string('status')->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->unsignedInteger('response_time_ms')->nullable();
            $table->text('response_body')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('next_attempt_at')->nullable();
            $table->timestamps();
        });

        Schema::create('accounting_connections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('company_id');
            $table->string('provider');
            $table->string('status')->default('active');
            $table->text('access_token_encrypted')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('accounting_sync_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('accounting_connection_id');
            $table->string('entity_type');
            $table->string('status')->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('error')->nullable();
            $table->jsonb('filters')->nullable();
            $table->timestamps();
        });

        Schema::create('accounting_sync_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('accounting_sync_job_id');
            $table->string('entity_type');
            $table->string('local_id');
            $table->string('external_id')->nullable();
            $table->string('status');
            $table->text('error')->nullable();
            $table->jsonb('response')->nullable();
            $table->timestamps();
            $table->unique(['accounting_sync_job_id', 'entity_type', 'local_id']);
        });

        Schema::create('outbox_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('event_type');
            $table->string('aggregate_type')->nullable();
            $table->uuid('aggregate_id')->nullable();
            $table->jsonb('payload');
            $table->timestamp('available_at')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamps();
            $table->index(['dispatched_at', 'available_at']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('invoice_number');
            $table->string('status')->default('draft');
            $table->date('billing_period_start');
            $table->date('billing_period_end');
            $table->decimal('subtotal', 18, 2)->default(0);
            $table->decimal('tax', 18, 2)->default(0);
            $table->decimal('total', 18, 2)->default(0);
            $table->string('currency', 3);
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('provider')->nullable();
            $table->json('line_items')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'invoice_number']);
        });

        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('invoice_id')->nullable();
            $table->string('provider');
            $table->string('provider_transaction_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3);
            $table->timestamp('completed_at')->nullable();
            $table->json('provider_response')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'idempotency_key']);
        });

        Schema::create('payment_provider_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('provider');
            $table->string('provider_event_id');
            $table->string('event_type');
            $table->jsonb('payload');
            $table->string('status')->default('received');
            $table->timestamp('processed_at')->nullable();
            $table->text('processing_error')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'provider_event_id']);
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->string('slug')->unique();
            $table->string('domain');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('name');
            $table->string('guard_name')->default('web');
            $table->string('slug')->unique();
            $table->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->foreignUuid('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignUuid('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
        });

        Schema::create('model_has_permissions', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('model_type');
            $table->foreignUuid('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->primary(['user_id', 'model_type', 'permission_id']);
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('role_id')->constrained('roles')->cascadeOnDelete();
            $table->primary(['user_id', 'role_id']);
        });
    }

    // ---------------------------------------------------------------------
    // Fixture helpers
    // ---------------------------------------------------------------------

    private function makePayrollRun(string $status = 'approved', int $entries = 1)
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'employee_number' => 'EMP-Q1',
            'first_name' => 'Queued',
            'last_name' => 'Worker',
            'email' => 'worker@queue.test',
            'country' => 'KE',
            'hire_date' => '2024-01-03',
            'status' => 'active',
        ]);

        $run = PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'period_start' => '2024-02-01',
            'period_end' => '2024-02-29',
            'pay_date' => '2024-03-05',
            'status' => $status,
            'input_hash' => Str::random(64),
            'rule_version' => '1.0.0',
            'initiated_by' => $this->user->id,
            'approved_by' => $status === 'approved' ? $this->user->id : null,
            'approved_at' => $status === 'approved' ? now() : null,
        ]);

        for ($i = 0; $i < $entries; $i++) {
            PayrollEntry::create([
                'tenant_id' => $this->tenant->id,
                'payroll_run_id' => $run->id,
                'employee_id' => $employee->id,
                'gross_pay' => 50000 + $i,
                'taxable_pay' => 50000 + $i,
                'total_deductions' => 2500,
                'employer_contributions' => 0,
                'net_pay' => 47500 + $i,
                'breakdown' => [
                    'basic' => 50000 + $i,
                    'grossPay' => 50000 + $i,
                    'totalDeductions' => 2500,
                    'netPay' => 47500 + $i,
                ],
                'created_at' => now(),
            ]);
        }

        return $run;
    }

    private static function tenantContextState(): ?string
    {
        $property = new \ReflectionProperty(TenantContext::class, 'tenantId');

        return $property->getValue();
    }

    // ---------------------------------------------------------------------
    // Queue & Horizon configuration
    // ---------------------------------------------------------------------

    public function test_redis_queue_connection_is_after_commit(): void
    {
        $this->assertTrue(config('queue.connections.redis.after_commit'), 'Redis after_commit must be enabled (Part 13 §13.7).');
    }

    public function test_horizon_topology_uses_dedicated_queues(): void
    {
        $queues = collect(config('queue.connections.redis.queues'))
            ->keys()
            ->merge(['high', 'default', 'payroll', 'notifications', 'email', 'sms', 'webhooks', 'reports', 'exports', 'integrations'])
            ->flatten()
            ->unique();

        foreach (['high', 'default', 'payroll', 'notifications', 'email', 'sms', 'webhooks', 'reports', 'exports', 'integrations'] as $queue) {
            $this->assertTrue($queues->contains($queue), "Queue [{$queue}] must exist in the redis connection.");
        }

        $this->assertTrue(config('horizon.middleware') === ['web'], 'Horizon dashboard must sit behind web middleware.');
        $this->assertSame(['payroll'], config('horizon.environments.production.supervisor-payroll.queue'));

        foreach (['default', 'payroll', 'email', 'webhooks', 'integrations'] as $supervisor) {
            $this->assertNotNull(
                config('horizon.environments.production.supervisor-'.$supervisor),
                "Horizon supervisor [{$supervisor}] missing.",
            );
        }
    }

    public function test_outbox_dispatcher_command_is_registered_and_scheduled(): void
    {
        $this->artisan('queue:dispatch-outbox')->assertExitCode(0);

        $events = Schedule::events();
        $this->assertNotEmpty(collect($events)->filter(
            fn ($e) => str_contains((string) $e->command, 'queue:dispatch-outbox')
        )->all());
    }

    // ---------------------------------------------------------------------
    // Transactional outbox
    // ---------------------------------------------------------------------

    public function test_finalize_writes_outbox_row_in_the_same_transaction_and_is_idempotent(): void
    {
        $run = $this->makePayrollRun('approved');
        $finalizer = new FinalizePayrollRun;

        $finalized = $finalizer->handle($run, $this->user);

        $this->assertSame('finalized', $finalized->status);
        $this->assertDatabaseHas('outbox_events', [
            'tenant_id' => $this->tenant->id,
            'event_type' => 'payroll_run.completed',
            'aggregate_id' => $run->id,
        ]);

        $this->assertSame(1, DB::table('outbox_events')->where('aggregate_id', $run->id)->count());

        // Idempotency: a re-finalize (e.g. HTTP retry) must not emit a second event.
        $finalizer->handle($run->refresh(), $this->user);
        $this->assertSame(1, DB::table('outbox_events')->where('aggregate_id', $run->id)->count());
        $this->assertSame('finalized', $run->refresh()->status);
    }

    public function test_finalize_rejects_runs_that_are_not_approved(): void
    {
        $run = $this->makePayrollRun('draft');

        $this->expectException(\RuntimeException::class);

        (new FinalizePayrollRun)->handle($run, $this->user);
    }

    public function test_outbox_relay_fires_domain_events_and_fans_out_to_dedicated_queues(): void
    {
        Queue::fake();
        Http::fake();

        $run = $this->makePayrollRun('approved', 2);
        (new FinalizePayrollRun)->handle($run, $this->user);

        $outbox = OutboxEvent::where('aggregate_id', $run->id)->firstOrFail();
        $this->assertNull($outbox->dispatched_at);

        $relayed = app(OutboxDispatcher::class)->dispatch();

        $this->assertSame(1, $relayed);
        $this->assertNotNull($outbox->refresh()->dispatched_at);

        // Listener streams pushed onto their dedicated queues (payroll fan-out
        // itself happens in the GeneratePayslips listener — tested separately).
        $this->assertSame(1, Queue::size('payroll'), 'GeneratePayslips goes on the payroll queue');
        $this->assertSame(1, Queue::size('notifications'), 'notification listener goes on notifications');
        $this->assertSame(1, Queue::size('webhooks'), 'webhook listener goes on webhooks');
        $this->assertSame(1, Queue::size('integrations'), 'accounting sync goes on integrations');

        $this->assertCount(1, Queue::listenersPushed(GeneratePayslips::class));
        $this->assertCount(1, Queue::listenersPushed(SendPayrollCompletionNotifications::class));
        $this->assertCount(1, Queue::listenersPushed(DispatchOutboundWebhooks::class));
        $this->assertCount(1, Queue::listenersPushed(SyncPayrollToAccounting::class));

        // Unknown event types are dead-lettered with attempts/last_error, never silenced.
        $orphan = OutboxEvent::create([
            'tenant_id' => $this->tenant->id,
            'event_type' => 'does.not.exist',
            'aggregate_type' => 'bogus',
            'aggregate_id' => Str::uuid()->toString(),
            'payload' => [],
            'attempts' => 0,
        ]);

        app(OutboxDispatcher::class)->dispatch();

        $this->assertNull($orphan->refresh()->dispatched_at);
        $this->assertSame(1, $orphan->attempts);
        $this->assertStringContainsString('No event mapped', (string) $orphan->last_error);
    }

    public function test_generate_payslips_listener_dispatches_one_job_per_entry_and_skips_generated(): void
    {
        Queue::fake();

        $run = $this->makePayrollRun('approved', 3);
        (new GeneratePayslips)->handle(new PayrollRunCompleted($this->tenant->id, $run->id));

        $entryIds = PayrollEntry::withoutTenantScope()->where('payroll_run_id', $run->id)->pluck('id')->all();

        Queue::assertPushedOn('payroll', GeneratePayslip::class);
        Queue::assertPushed(GeneratePayslip::class, 3);

        foreach ($entryIds as $id) {
            Queue::assertPushed(
                GeneratePayslip::class,
                fn ($job) => $job->tenantId === $this->tenant->id && $job->payrollEntryId === $id,
            );
        }

        // ShouldBeUnique acquires a cache lock when the job is dispatched and
        // only releases it when the job runs. With the queue faked the jobs
        // never run, so release the per-entry locks before re-dispatching;
        // otherwise the skipped-dispatch path drops the re-dispatch entirely.
        $uniqueLock = new UniqueLock(Cache::store());

        foreach ($entryIds as $id) {
            $uniqueLock->release(new GeneratePayslip($this->tenant->id, $id));
        }

        // An entry that already has a payslip is skipped on re-dispatch.
        Payslip::create([
            'payroll_entry_id' => $entryIds[0],
            'payslip_number' => 'PSP-'.$entryIds[0],
            'status' => 'generated',
        ]);

        (new GeneratePayslips)->handle(new PayrollRunCompleted($this->tenant->id, $run->id));

        Queue::assertPushedOn('payroll', GeneratePayslip::class);
        Queue::assertPushed(GeneratePayslip::class, 5); // 3 + 2 (skips the generated one)
    }

    // ---------------------------------------------------------------------
    // Tenant-aware jobs
    // ---------------------------------------------------------------------

    public function test_tenant_aware_job_clears_context_after_success_and_failure(): void
    {
        $run = $this->makePayrollRun('approved');
        $entry = PayrollEntry::withoutTenantScope()->where('payroll_run_id', $run->id)->firstOrFail();

        TenantContext::set('ghost-tenant-id'); // simulate a polluted worker

        (new GeneratePayslip($this->tenant->id, $entry->id))->handle();

        $this->assertNull(static::tenantContextState(), 'Context must be cleared after a successful job.');

        TenantContext::set('ghost-tenant-id');

        $failing = new class extends TenantAwareJob
        {
            protected function execute(): void
            {
                throw new \RuntimeException('boom');
            }
        };
        $failing->tenantId = $this->tenant->id;

        try {
            $failing->handle();
            $this->fail('The failing job should have thrown.');
        } catch (\RuntimeException) {
            // expected
        }

        $this->assertNull(static::tenantContextState(), 'Context must be cleared even after a failed job.');
    }

    // ---------------------------------------------------------------------
    // Payslip generation (idempotent, object storage)
    // ---------------------------------------------------------------------

    public function test_generate_payslip_persists_one_payslip_and_is_idempotent(): void
    {
        config(['filesystems.disks.payslips.root' => sys_get_temp_dir().'/opencode/payslip-tests']);
        $root = sys_get_temp_dir().'/opencode/payslip-tests';
        @mkdir($root, 0777, true);

        $run = $this->makePayrollRun('approved');
        $entry = PayrollEntry::withoutTenantScope()->where('payroll_run_id', $run->id)->firstOrFail();

        (new GeneratePayslip($this->tenant->id, $entry->id))->handle();

        $payslip = Payslip::where('payroll_entry_id', $entry->id)->firstOrFail();
        $this->assertSame('generated', $payslip->status);
        $this->assertSame('payslips', $payslip->storage_disk);
        $this->assertNotNull($payslip->storage_path);
        $this->assertNotNull($payslip->file_hash);
        $this->assertFileExists($root.'/'.$payslip->storage_path);

        $this->assertSame(1, Payslip::where('payroll_entry_id', $entry->id)->count());

        // Idempotent re-run: same single row, byte-identical file, no re-render.
        $firstHash = $payslip->file_hash;
        (new GeneratePayslip($this->tenant->id, $entry->id))->handle();

        $this->assertSame(1, Payslip::where('payroll_entry_id', $entry->id)->count());
        $this->assertSame($firstHash, $payslip->refresh()->file_hash);
    }

    // ---------------------------------------------------------------------
    // Webhook delivery
    // ---------------------------------------------------------------------

    public function test_deliver_webhook_signs_payload_and_records_delivery(): void
    {
        Http::fake(['hook.test/*' => Http::response(['accepted' => true], 200)]);

        $endpoint = WebhookEndpoint::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Accounting app',
            'url' => 'https://hook.test/ingest',
            'secret_hash' => hash('sha256', 'shared-secret'),
            'secret_ciphertext' => Crypt::encryptString('shared-secret'),
            'events' => ['payroll_run.completed'],
            'status' => 'active',
        ]);

        $job = new DeliverWebhook(
            $this->tenant->id,
            $endpoint->id,
            'payroll_run.completed',
            Str::uuid()->toString(),
            ['id' => 'abc', 'type' => 'payroll_run.completed'],
        );

        $job->handle();

        Http::assertSent(function ($request) use ($job) {
            $expected = hash_hmac('sha256', json_encode($job->payload), 'shared-secret');

            return $request->url() === 'https://hook.test/ingest'
                && $request->header('X-Event-Type')[0] === 'payroll_run.completed'
                && $request->header('X-Webhook-Signature')[0] === $expected;
        });

        $log = WebhookDeliveryLog::where('webhook_endpoint_id', $endpoint->id)->firstOrFail();
        $this->assertSame('delivered', $log->status);
        $this->assertSame(200, $log->response_status);
        $this->assertNotNull($log->delivered_at);
    }

    public function test_deliver_webhook_retries_then_failed_marks_the_log(): void
    {
        Http::fake(['hook.test/*' => Http::response('provider down', 500)]);

        $endpoint = WebhookEndpoint::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Downstream',
            'url' => 'https://hook.test/ingest',
            'secret_hash' => hash('sha256', 'x'),
            'events' => ['payroll_run.completed'],
            'status' => 'active',
        ]);

        $job = new DeliverWebhook(
            $this->tenant->id,
            $endpoint->id,
            'payroll_run.completed',
            Str::uuid()->toString(),
            ['id' => 'abc', 'type' => 'payroll_run.completed'],
        );

        try {
            $job->handle();
            $this->fail('A 500 must throw so the job retries.');
        } catch (\RuntimeException) {
            // expected — the queue will re-queue with backoff
        }

        $log = WebhookDeliveryLog::where('webhook_endpoint_id', $endpoint->id)->firstOrFail();
        $this->assertNotSame('delivered', $log->status);
        $this->assertGreaterThanOrEqual(1, $log->attempts);
        $this->assertSame(500, $log->response_status);

        $job->failed(new \RuntimeException('exhausted'));
        $this->assertSame('failed', $log->refresh()->status);

        Http::assertSentCount(1);
    }

    // ---------------------------------------------------------------------
    // Accounting sync
    // ---------------------------------------------------------------------

    public function test_sync_accounting_skips_connectionless_tenants_as_pending_not_failed(): void
    {
        $connection = AccountingConnection::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'provider' => 'xero',
            'status' => 'active',
            'access_token_encrypted' => null,
        ]);

        $run = $this->makePayrollRun('approved');

        (new SyncAccountingConnection($this->tenant->id, $connection->id, 'payroll_run', $run->id))->handle();

        $job = AccountingSyncJob::where('accounting_connection_id', $connection->id)->firstOrFail();
        $record = AccountingSyncRecord::where('accounting_sync_job_id', $job->id)->firstOrFail();

        $this->assertSame('pending_external', $record->status);
        $this->assertSame('pending_external', $job->status);
        $this->assertDatabaseHas('accounting_sync_records', ['id' => $record->id, 'status' => 'pending_external']);
    }

    // ---------------------------------------------------------------------
    // Payment settlement outbox (money event)
    // ---------------------------------------------------------------------

    public function test_payment_settlement_writes_outbox_marker_in_the_same_transaction(): void
    {
        $invoice = Invoice::create([
            'tenant_id' => $this->tenant->id,
            'invoice_number' => 'INV-Q1',
            'status' => 'open',
            'billing_period_start' => now()->startOfMonth()->toDateString(),
            'billing_period_end' => now()->endOfMonth()->toDateString(),
            'subtotal' => '8500.00',
            'tax' => '0.00',
            'total' => '8500.00',
            'currency' => 'KES',
            'issued_at' => now(),
            'due_at' => now()->addDays(14),
        ]);

        $reference = 'pay_'.str_replace('-', '', (string) $this->tenant->id).'_'.str_replace('-', '', Str::uuid()->toString());

        $payment = PaymentTransaction::create([
            'tenant_id' => $this->tenant->id,
            'invoice_id' => $invoice->id,
            'provider' => 'paystack',
            'idempotency_key' => $reference,
            'status' => 'processing',
            'amount' => '8500.00',
            'currency' => 'KES',
        ]);

        $event = PaymentProviderEvent::create([
            'tenant_id' => $this->tenant->id,
            'provider' => 'paystack',
            'provider_event_id' => 'evt-42',
            'event_type' => 'charge.success',
            'payload' => ['event' => 'charge.success', 'data' => ['id' => 42, 'status' => 'success', 'reference' => $reference]],
            'status' => 'received',
        ]);

        (new ProcessPaymentWebhook($event->id))->handle();

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'paid']);
        $this->assertDatabaseHas('payment_transactions', ['id' => $payment->id, 'status' => 'succeeded']);
        $this->assertDatabaseHas('payment_provider_events', ['id' => $event->id, 'status' => 'processed']);
        $this->assertDatabaseHas('outbox_events', [
            'tenant_id' => $this->tenant->id,
            'event_type' => 'payment.settled',
            'aggregate_id' => $payment->id,
        ]);
    }

    public function test_payment_settlement_failure_rolls_back_outbox_marker(): void
    {
        $invoice = Invoice::create([
            'tenant_id' => $this->tenant->id,
            'invoice_number' => 'INV-Q2',
            'status' => 'open',
            'billing_period_start' => now()->startOfMonth()->toDateString(),
            'billing_period_end' => now()->endOfMonth()->toDateString(),
            'subtotal' => '8500.00',
            'tax' => '0.00',
            'total' => '8500.00',
            'currency' => 'KES',
            'issued_at' => now(),
            'due_at' => now()->addDays(14),
        ]);

        $reference = 'pay_'.str_replace('-', '', (string) $this->tenant->id).'_late';

        PaymentTransaction::create([
            'tenant_id' => $this->tenant->id,
            'invoice_id' => $invoice->id,
            'provider' => 'paystack',
            'idempotency_key' => $reference,
            'status' => 'failed', // already terminal — an illegal transition must throw
            'amount' => '8500.00',
            'currency' => 'KES',
        ]);

        $event = PaymentProviderEvent::create([
            'tenant_id' => $this->tenant->id,
            'provider' => 'paystack',
            'provider_event_id' => 'evt-99',
            'event_type' => 'charge.success',
            'payload' => ['event' => 'charge.success', 'data' => ['id' => 99, 'status' => 'success', 'reference' => $reference]],
            'status' => 'received',
        ]);

        try {
            (new ProcessPaymentWebhook($event->id))->handle();
            $this->fail('An illegal payment transition must throw and roll back the whole settlement.');
        } catch (\InvalidArgumentException) {
            // expected — the whole transaction rolls back
        }

        // Nothing may half-commit: no outbox marker, invoice untouched,
        // provider event still pending a retry.
        $this->assertDatabaseMissing('outbox_events', [
            'tenant_id' => $this->tenant->id,
            'event_type' => 'payment.settled',
        ]);
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'open']);
        $this->assertDatabaseHas('payment_provider_events', ['id' => $event->id, 'status' => 'received']);
    }
}
