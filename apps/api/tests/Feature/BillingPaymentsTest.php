<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\PaymentTransaction;
use App\Models\Permission;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class BillingPaymentsTest extends TestCase
{
    private User $user;

    private Tenant $tenant;

    private Plan $plan;

    private Subscription $subscription;

    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createMinimalSchema();

        $this->tenant = Tenant::create([
            'name' => 'Billing Co',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
        ]);

        $this->user = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Billing Admin',
            'email' => 'billing-'.Str::uuid().'@test',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
        ]);

        Permission::updateOrCreate(
            ['name' => 'billing.view'],
            ['slug' => 'billing.view', 'domain' => 'billing', 'guard_name' => 'web'],
        );
        Permission::updateOrCreate(
            ['name' => 'billing.manage'],
            ['slug' => 'billing.manage', 'domain' => 'billing', 'guard_name' => 'web'],
        );

        $this->user->givePermissionTo('billing.view');
        $this->user->givePermissionTo('billing.manage');

        $this->plan = Plan::create([
            'name' => 'Professional',
            'slug' => (string) Str::uuid(),
            'monthly_price' => '8500.00',
            'annual_price' => '91800.00',
            'included_employees' => 100,
            'features' => ['payroll', 'reports'],
            'status' => 'active',
        ]);

        $this->subscription = Subscription::create([
            'tenant_id' => $this->tenant->id,
            'plan_id' => $this->plan->id,
            'status' => 'active',
            'starts_at' => now()->subMonths(2)->startOfDay(),
            'ends_at' => now()->subDay()->endOfDay(),
            'provider' => 'development',
        ]);

        $this->invoice = Invoice::create([
            'tenant_id' => $this->tenant->id,
            'subscription_id' => $this->subscription->id,
            'invoice_number' => 'INV-ACME-0001',
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

        $this->actingAs($this->user, 'sanctum');
    }

    private function postRaw(string $uri, string $content, array $headers = []): TestResponse
    {
        return $this->call(
            'POST',
            $uri,
            [],
            [],
            [],
            $this->transformHeadersToServerVars($headers),
            $content,
        );
    }

    protected function createMinimalSchema(): void
    {
        $tables = [
            'outbox_events',
            'payment_provider_events',
            'payment_transactions',
            'usage_records',
            'invoices',
            'subscriptions',
            'plans',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
            'user_roles',
            'role_permissions',
            'permissions',
            'roles',
            'users',
            'tenants',
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

        Schema::create('plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->decimal('monthly_price', 18, 2);
            $table->decimal('annual_price', 18, 2);
            $table->unsignedInteger('included_employees')->default(0);
            $table->json('features')->default('[]');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->unique();
            $table->foreignUuid('plan_id')->constrained('plans');
            $table->string('status')->default('trialing');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('provider')->nullable();
            $table->string('provider_subscription_id')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'provider_subscription_id']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreignUuid('subscription_id')->nullable()->constrained('subscriptions')->nullOnDelete();
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
            $table->string('provider_invoice_id')->nullable();
            $table->jsonb('line_items')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'invoice_number']);
        });

        // Mirrors the real partial unique index so renewal is idempotent.
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS invoices_subscription_billing_period_uq
             ON invoices (subscription_id, billing_period_start)
             WHERE subscription_id IS NOT NULL'
        );

        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->foreignUuid('invoice_id')->nullable()->constrained('invoices')->restrictOnDelete();
            $table->string('provider');
            $table->string('provider_transaction_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3);
            $table->timestamp('completed_at')->nullable();
            $table->jsonb('provider_response')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'provider_transaction_id']);
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

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->uuid('permission_id');
            $table->uuid('role_id');
        });
    }

    public function test_payment_transaction_state_machine_guards_terminal_transitions(): void
    {
        $payment = PaymentTransaction::create([
            'tenant_id' => $this->tenant->id,
            'invoice_id' => $this->invoice->id,
            'provider' => 'paystack',
            'idempotency_key' => 'pay_'.$this->tenant->id.'_abc123',
            'status' => 'pending',
            'amount' => '8500.00',
            'currency' => 'KES',
        ]);

        $this->assertTrue($payment->transitionTo('processing', 'ref-001'));
        $this->assertSame('processing', $payment->status);

        $this->assertTrue($payment->transitionTo('succeeded', 'trx-001', ['status' => 'success']));
        $this->assertSame('succeeded', $payment->status);
        $this->assertNotNull($payment->completed_at);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Cannot transition');

        $payment->transitionTo('processing');
    }

    public function test_duplicate_webhook_delivery_is_treated_as_no_op(): void
    {
        $payment = PaymentTransaction::create([
            'tenant_id' => $this->tenant->id,
            'invoice_id' => $this->invoice->id,
            'provider' => 'paystack',
            'idempotency_key' => 'pay_'.$this->tenant->id.'_abc123',
            'status' => 'pending',
            'amount' => '8500.00',
            'currency' => 'KES',
        ]);

        $this->assertTrue($payment->transitionTo('succeeded', 'trx-001'));
        $refresh = $payment->refresh();

        $this->assertTrue($refresh->transitionTo('succeeded', 'trx-002'));
        $this->assertSame('trx-001', $refresh->provider_transaction_id);
        $this->assertNotNull($refresh->completed_at);
    }

    public function test_webhook_intake_performs_hmac_verification_and_transitions_payment(): void
    {
        Config::set('services.paystack.secret_key', 'sk_test_secret');

        $payment = PaymentTransaction::create([
            'tenant_id' => $this->tenant->id,
            'invoice_id' => $this->invoice->id,
            'provider' => 'paystack',
            'idempotency_key' => 'pay_'.str_replace('-', '', (string) $this->tenant->id).'_afternoon',
            'status' => 'processing',
            'provider_transaction_id' => 'pay_'.str_replace('-', '', (string) $this->tenant->id).'_afternoon',
            'amount' => '8500.00',
            'currency' => 'KES',
        ]);

        $payload = [
            'event' => 'charge.success',
            'data' => [
                'id' => 8092387,
                'status' => 'success',
                'reference' => $payment->idempotency_key,
            ],
        ];

        $rawPayload = json_encode($payload);
        $signature = hash_hmac('sha512', $rawPayload, 'sk_test_secret');

        $response = $this->postRaw('/api/v1/webhooks/paystack', $rawPayload, ['X-Paystack-Signature' => $signature]);

        $response->assertStatus(202);

        $this->assertDatabaseHas('payment_provider_events', [
            'provider' => 'paystack',
            'provider_event_id' => $payload['data']['id'],
            'status' => 'processed',
        ]);

        $this->assertDatabaseHas('payment_transactions', [
            'id' => $payment->id,
            'status' => 'succeeded',
            'provider_transaction_id' => '8092387',
        ]);

        $this->assertDatabaseHas('invoices', [
            'id' => $this->invoice->id,
            'status' => 'paid',
        ]);
    }

    public function test_webhook_intake_rejects_invalid_signature(): void
    {
        Config::set('services.paystack.secret_key', 'sk_test_secret');

        $payload = json_encode(['event' => 'charge.success', 'data' => ['reference' => 'abc']]);
        $signature = hash_hmac('sha512', $payload, 'wrong-secret');

        $response = $this->postRaw('/api/v1/webhooks/paystack', $payload, ['X-Paystack-Signature' => $signature]);

        $response->assertStatus(400);

        $this->assertDatabaseMissing('payment_provider_events', ['provider' => 'paystack']);
    }

    public function test_webhook_intake_is_idempotent_for_duplicate_provider_events(): void
    {
        Config::set('services.paystack.secret_key', 'sk_test_secret');

        $payload = ['event' => 'charge.success', 'data' => ['id' => 99, 'status' => 'success', 'reference' => 'pay_'.$this->tenant->id.'_xyz']];
        $rawPayload = json_encode($payload);
        $signature = hash_hmac('sha512', $rawPayload, 'sk_test_secret');

        $request = fn () => $this->postRaw('/api/v1/webhooks/paystack', $rawPayload, ['X-Paystack-Signature' => $signature]);

        $request()->assertStatus(202);
        $request()->assertStatus(202);

        $this->assertSame(1, DB::table('payment_provider_events')->where('provider_event_id', 99)->count());
    }

    public function test_billing_invoices_require_billing_view_permission(): void
    {
        $this->user->revokePermissionTo('billing.view');
        $this->user->revokePermissionTo('billing.manage');

        $this->getJson('/api/v1/billing/invoices')->assertForbidden();
        $this->postJson('/api/v1/billing/invoices/'.$this->invoice->id.'/payments', ['provider' => 'paystack'])
            ->assertForbidden();
    }

    public function test_payment_status_polling_is_tenant_scoped(): void
    {
        $payment = PaymentTransaction::create([
            'tenant_id' => $this->tenant->id,
            'invoice_id' => $this->invoice->id,
            'provider' => 'paystack',
            'idempotency_key' => 'pay_'.$this->tenant->id.'_poll',
            'status' => 'processing',
            'amount' => '8500.00',
            'currency' => 'KES',
        ]);

        $this->getJson('/api/v1/billing/payments/'.$payment->id)->assertOk();

        $otherTenant = Tenant::create([
            'name' => 'Other Co',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
        ]);

        $otherUser = User::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Other Admin',
            'email' => 'other-'.Str::uuid().'@test',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
        ]);
        $otherUser->givePermissionTo('billing.view');

        $this->actingAs($otherUser, 'sanctum');

        $this->getJson('/api/v1/billing/payments/'.$payment->id)->assertNotFound();
    }

    public function test_subscription_renewal_is_idempotent(): void
    {
        $this->artisan('billing:process-subscription-renewals')->assertExitCode(0);

        $this->assertDatabaseCount('invoices', 2);
        $this->assertDatabaseHas('invoices', [
            'subscription_id' => $this->subscription->id,
            'status' => 'open',
            'subtotal' => 8500,
            'billing_period_start' => $this->subscription->ends_at->copy()->startOfDay()->toDateTimeString(),
        ]);

        $this->artisan('billing:process-subscription-renewals')->assertExitCode(0);

        $this->assertDatabaseCount('invoices', 2);
    }
}
