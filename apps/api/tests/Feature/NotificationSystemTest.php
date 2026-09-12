<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Compliance\Events\ComplianceReportGenerated;
use App\Domain\Notifications\NotificationDispatcher;
use App\Domain\Notifications\NotificationTypes;
use App\Domain\Notifications\Providers\PushProvider;
use App\Domain\Notifications\TemplateRenderer;
use App\Domain\Payments\Events\PaymentFailed;
use App\Domain\Payments\Events\PaymentSucceeded;
use App\Domain\Payroll\Events\PayrollRunCompleted;
use App\Jobs\SendNotificationDelivery;
use App\Listeners\NotifyComplianceReportReady;
use App\Listeners\NotifyNewLogin;
use App\Listeners\NotifyPaymentFailed;
use App\Listeners\NotifyPaymentSucceeded;
use App\Listeners\SendPayrollCompletionNotifications;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\NotificationTemplate;
use App\Models\PaymentTransaction;
use App\Models\PushSubscription;
use App\Models\User;
use App\Providers\EventServiceProvider;
use Database\Seeders\NotificationTemplateSeeder;
use Illuminate\Auth\Events\Login;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

/**
 * Part 14 — Notification system (backend-authoritative).
 *
 * Covers: dispatcher behaviour (preferences, idempotency, fallback rendering),
 * template variable allow-listing, per-channel provider hand-off (email/sms/
 * push), delivery job retry semantics, event listener fan-out for payroll /
 * billing / compliance / auth, tenancy + ownership isolation, and the full API
 * surface (/notifications, /notification-preferences, /push-subscriptions).
 */
class NotificationSystemTest extends BaseTestCase
{
    private string $tenantId;

    private string $adminId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->createMinimalSchema();

        $this->tenantId = (string) Str::uuid();
        $this->adminId = (string) Str::uuid();

        DB::table('tenants')->insert([
            'id' => $this->tenantId,
            'name' => 'Acme Ltd',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->createUser($this->adminId, 'admin@test.com');
    }

    public function test_dispatcher_creates_notification_and_default_deliveries(): void
    {
        $dispatcher = app(NotificationDispatcher::class);

        $created = $dispatcher->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::PAYROLL_RUN_COMPLETED,
            ['run_id' => 'run-1', 'company' => 'Acme Ltd'],
        );

        $this->assertCount(1, $created);

        $notification = Notification::withoutTenantScope()->first();
        $this->assertNotNull($notification);
        $this->assertSame($this->adminId, $notification->user_id);
        $this->assertSame(NotificationTypes::PAYROLL_RUN_COMPLETED, $notification->event_type);
        $this->assertSame('Acme Ltd', $notification->data['company']);

        // Defaults: in_app + email on, sms + push off.
        $channels = $notification->deliveries()->withoutGlobalScopes()->pluck('channel')->all();
        $this->assertEqualsCanonicalizing(['in_app', 'email'], $channels);

        $inApp = $notification->deliveries()->withoutGlobalScopes()->where('channel', 'in_app')->first();
        $this->assertSame('sent', $inApp->status);

        // Email channel hands off to the array mailer and marks the delivery sent.
        $email = $notification->deliveries()->withoutGlobalScopes()->where('channel', 'email')->first();
        $this->assertSame('sent', $email->status);
        $this->assertNotNull($email->sent_at);

        // A preference row was materialised with the default toggles.
        $preference = NotificationPreference::withoutTenantScope()->first();
        $this->assertSame(NotificationTypes::PAYROLL_RUN_COMPLETED, $preference->event_type);
        $this->assertTrue($preference->in_app);
        $this->assertTrue($preference->email);
        $this->assertFalse($preference->sms);
    }

    public function test_dispatcher_is_idempotent_for_entity_keyed_events(): void
    {
        $dispatcher = app(NotificationDispatcher::class);

        $dispatcher->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::BILLING_PAYMENT_SUCCEEDED,
            [
                'transaction_id' => 'pay-1',
                'amount' => '250.00',
                'currency' => 'KES',
                'entity_type' => 'payment_transaction',
                'entity_id' => 'pay-1',
            ],
        );
        $dispatcher->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::BILLING_PAYMENT_SUCCEEDED,
            [
                'transaction_id' => 'pay-1',
                'amount' => '250.00',
                'currency' => 'KES',
                'entity_type' => 'payment_transaction',
                'entity_id' => 'pay-1',
            ],
        );

        $this->assertSame(1, Notification::withoutTenantScope()->count());
    }

    public function test_dispatcher_honours_user_preferences(): void
    {
        NotificationPreference::withoutTenantScope()->create([
            'tenant_id' => $this->tenantId,
            'user_id' => $this->adminId,
            'event_type' => NotificationTypes::BILLING_PAYMENT_FAILED,
            'in_app' => false,
            'email' => false,
            'sms' => false,
            'push' => false,
        ]);

        $created = app(NotificationDispatcher::class)->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::BILLING_PAYMENT_FAILED,
            ['amount' => '100.00', 'currency' => 'KES'],
        );

        // No enabled channel → no notification row at all.
        $this->assertSame([], $created);
        $this->assertSame(0, Notification::withoutTenantScope()->count());
    }

    public function test_renderer_only_interpolates_declared_variables(): void
    {
        NotificationTemplate::query()->create([
            'tenant_id' => null,
            'code' => NotificationTypes::PAYROLL_RUN_COMPLETED,
            'channel' => 'in_app',
            'subject' => 'Payroll for {{ company }}',
            'body' => 'Hello {{ company }} — {{ not_declared }} — {{ malicious }}',
            'variables' => ['company'],
            'active' => true,
        ]);

        $rendered = app(TemplateRenderer::class)->render(
            $this->tenantId,
            NotificationTypes::PAYROLL_RUN_COMPLETED,
            'in_app',
            [
                'company' => 'Acme Ltd',
                'not_declared' => 'SNEAKY',
                'malicious' => '<script>alert(1)</script>',
            ],
        );

        $this->assertSame('Payroll for Acme Ltd', $rendered['subject']);
        $this->assertSame('Hello Acme Ltd —  — ', $rendered['body']);
    }

    public function test_renderer_falls_back_when_no_template_exists(): void
    {
        $rendered = app(TemplateRenderer::class)->render(
            $this->tenantId,
            NotificationTypes::BILLING_PAYMENT_FAILED,
            'in_app',
            ['amount' => '9.99', 'currency' => 'USD'],
        );

        $this->assertNull($rendered['template']);
        $this->assertSame('Payment failed', $rendered['subject']);
        $this->assertStringContainsString('payment could not be completed', strtolower($rendered['body']));
    }

    public function test_email_channel_sends_a_plain_text_mail(): void
    {
        $created = app(NotificationDispatcher::class)->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::PAYROLL_RUN_COMPLETED,
            ['company' => 'Acme Ltd'],
        );

        $notification = $created[0];
        $email = $notification->deliveries()->withoutGlobalScopes()->where('channel', 'email')->first();

        // 'sent' proves Mail::raw() completed via the array transport without
        // an exception, and attempts records the single sync-queue run.
        $this->assertSame('sent', $email->status);
        $this->assertSame(1, $email->attempts);
    }

    public function test_sms_channel_fails_cleanly_without_phone_and_sends_with_one(): void
    {
        $notification = Notification::withoutTenantScope()->create([
            'tenant_id' => $this->tenantId,
            'user_id' => $this->adminId,
            'event_type' => NotificationTypes::BILLING_PAYMENT_FAILED,
            'title' => 'Payment failed',
            'body' => 'Your payment could not be completed.',
            'data' => ['amount' => '100.00', 'currency' => 'KES'],
        ]);

        $sms = $notification->deliveries()->withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantId,
            'channel' => 'sms',
            'status' => 'queued',
            'attempts' => 0,
        ]);

        // No phone on the event data → the channel throws, the job records the
        // miss (attempts/error/failed_at) and re-raises so the queue retries.
        // The row intentionally stays 'queued' until the queue gives up.
        try {
            (new SendNotificationDelivery($sms->id, $this->tenantId))->handle();
        } catch (\Throwable) {
            // expected — sms delivery has no phone number
        }

        $sms->refresh();
        $this->assertSame('queued', $sms->status);
        $this->assertStringContainsString('phone', strtolower((string) $sms->last_error));
        $this->assertSame(1, $sms->attempts);
        $this->assertNotNull($sms->failed_at);

        // Simulate the queue exhausting retries → dead-lettered as failed.
        (new SendNotificationDelivery($sms->id, $this->tenantId))
            ->failed(new \RuntimeException('exhausted retries'));
        $this->assertSame('failed', $sms->refresh()->status);

        // Now supply a phone and confirm the same delivery retries to sent.
        $sms->forceFill(['status' => 'queued', 'failed_at' => null, 'last_error' => null])->save();
        $notification->forceFill(['data' => ['phone' => '+254700000000', 'amount' => '100.00', 'currency' => 'KES']])->save();

        (new SendNotificationDelivery($sms->id, $this->tenantId))->handle();

        $sms->refresh();
        $this->assertSame('sent', $sms->status);
        $this->assertSame(2, $sms->attempts);
    }

    public function test_push_channel_fans_out_to_subscriptions(): void
    {
        // Swapping the bound PushProvider is the documented extension point —
        // the registry factory resolves it lazily, so a plain rebind is enough.
        $seen = new \stdClass;
        $seen->endpoints = [];

        $this->app->bind(PushProvider::class, function () use ($seen) {
            return new class($seen) implements PushProvider
            {
                public function __construct(private \stdClass $seen) {}

                public function send(PushSubscription $subscription, string $title, string $body, ?string $url = null): void
                {
                    $this->seen->endpoints[] = $subscription->endpoint;
                }
            };
        });

        NotificationPreference::withoutTenantScope()->create([
            'tenant_id' => $this->tenantId,
            'user_id' => $this->adminId,
            'event_type' => NotificationTypes::PAYROLL_RUN_COMPLETED,
            'push' => true,
        ]);

        PushSubscription::withoutTenantScope()->create([
            'tenant_id' => $this->tenantId,
            'user_id' => $this->adminId,
            'endpoint' => 'https://push.example.test/1',
            'public_key' => 'p256dh-1',
            'auth_token' => 'auth-1',
        ]);

        $created = app(NotificationDispatcher::class)->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::PAYROLL_RUN_COMPLETED,
            ['company' => 'Acme Ltd'],
        );

        $push = $created[0]->deliveries()->withoutGlobalScopes()->where('channel', 'push')->first();
        $this->assertSame('sent', $push->status);
        $this->assertSame(['https://push.example.test/1'], $seen->endpoints);
    }

    public function test_email_delivery_records_attempts_on_each_send(): void
    {
        $created = app(NotificationDispatcher::class)->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::PAYROLL_RUN_COMPLETED,
            ['company' => 'Acme Ltd'],
        );

        $email = $created[0]->deliveries()->withoutGlobalScopes()->where('channel', 'email')->first();
        $this->assertSame('sent', $email->status);
        $this->assertSame(1, $email->attempts);

        // A re-queued delivery (as after a queue restart) increments attempts
        // while remaining consistent: already-sent terminals are skipped.
        $email->forceFill(['status' => 'queued'])->save();
        (new SendNotificationDelivery($email->id, $this->tenantId))->handle();

        $email->refresh();
        $this->assertSame('sent', $email->status);
        $this->assertSame(2, $email->attempts);
    }

    public function test_payroll_listener_writes_notification_for_initiator(): void
    {
        $runId = (string) Str::uuid();
        $companyId = (string) Str::uuid();

        DB::table('companies')->insert([
            'id' => $companyId,
            'tenant_id' => $this->tenantId,
            'name' => 'Acme Ltd',
            'country' => 'KE',
            'currency' => 'KES',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payroll_runs')->insert([
            'id' => $runId,
            'tenant_id' => $this->tenantId,
            'company_id' => $companyId,
            'period_start' => now()->startOfMonth(),
            'period_end' => now()->endOfMonth(),
            'pay_date' => now(),
            'status' => 'finalized',
            'input_hash' => str_repeat('a', 64),
            'rule_version' => 'KE-2025',
            'initiated_by' => $this->adminId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        (new SendPayrollCompletionNotifications)->handle(
            new PayrollRunCompleted($this->tenantId, $runId),
        );

        $this->assertSame(1, Notification::withoutTenantScope()->count());

        $notification = Notification::withoutTenantScope()->first();
        $this->assertSame($this->adminId, $notification->user_id);
        $this->assertSame(NotificationTypes::PAYROLL_RUN_COMPLETED, $notification->event_type);
        $this->assertSame('Acme Ltd', $notification->data['company']);
        $this->assertNotNull($notification->dedupe_hash);
    }

    public function test_payment_succeeded_listener_notifies_tenant_users(): void
    {
        $transactionId = (string) Str::uuid();

        DB::table('payment_transactions')->insert([
            'id' => $transactionId,
            'tenant_id' => $this->tenantId,
            'provider' => 'paystack',
            'idempotency_key' => 'key-1',
            'status' => 'succeeded',
            'amount' => '250.00',
            'currency' => 'KES',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $transaction = PaymentTransaction::withoutTenantScope()->find($transactionId);

        (new NotifyPaymentSucceeded)->handle(new PaymentSucceeded($transaction));

        $this->assertSame(1, Notification::withoutTenantScope()->count());

        $notification = Notification::withoutTenantScope()->first();
        $this->assertSame(NotificationTypes::BILLING_PAYMENT_SUCCEEDED, $notification->event_type);
        $this->assertSame('250.00', $notification->data['amount']);
        $this->assertSame($transactionId, $notification->data['entity_id']);
    }

    public function test_compliance_listener_notifies_initiator(): void
    {
        $reportId = (string) Str::uuid();

        DB::table('compliance_reports')->insert([
            'id' => $reportId,
            'tenant_id' => $this->tenantId,
            'company_id' => (string) Str::uuid(),
            'payroll_run_id' => (string) Str::uuid(),
            'country' => 'KE',
            'report_code' => 'KE-P9',
            'report_version' => '2026',
            'status' => 'generated',
            'generated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        (new NotifyComplianceReportReady)->handle(
            new ComplianceReportGenerated($this->tenantId, $reportId, $this->adminId),
        );

        $notification = Notification::withoutTenantScope()->first();
        $this->assertSame($this->adminId, $notification->user_id);
        $this->assertSame(NotificationTypes::COMPLIANCE_REPORT_READY, $notification->event_type);
        $this->assertSame('KE-P9', $notification->data['report_code']);
    }

    public function test_new_login_listener_is_registered_and_dispatches_notifications(): void
    {
        // Registration is the security-relevant part: Login must fan out to the
        // listener via the event dispatcher (not just by hand).
        $listen = $this->app->getProvider(EventServiceProvider::class)->listens();
        $this->assertContains(NotifyNewLogin::class, $listen[Login::class]);

        // And the listener itself produces a notification (sync, session-aware).
        $request = Request::create('/api/login', 'POST');
        $request->setLaravelSession($this->app['session']->driver());
        $this->app->instance('request', $request);

        // NOTE: this framework version constructs Login as (guard, user, remember).
        (new NotifyNewLogin)->handle(new Login('web', $this->user(), false));

        $notification = Notification::withoutTenantScope()->first();
        $this->assertNotNull($notification);
        $this->assertSame(NotificationTypes::AUTH_LOGIN_NEW_DEVICE, $notification->event_type);
        $this->assertStringContainsString('sign-in', strtolower((string) $notification->title));
    }

    public function test_event_service_provider_maps_compliance_and_payment_events(): void
    {
        $listen = $this->app->getProvider(EventServiceProvider::class)->listens();

        $this->assertContains(NotifyComplianceReportReady::class, $listen[ComplianceReportGenerated::class]);
        $this->assertContains(NotifyPaymentSucceeded::class, $listen[PaymentSucceeded::class]);
        $this->assertContains(NotifyPaymentFailed::class, $listen[PaymentFailed::class]);
    }

    public function test_api_lists_filters_and_marks_read(): void
    {
        $this->seedFair();
        Sanctum::actingAs($this->user());

        // Two notifications, one read.
        $unread = $this->makeNotification('One', false);
        $this->makeNotification('Two', true);

        $response = $this->getJson('/api/notifications');
        $response->assertOk();
        $body = $response->json();
        $this->assertCount(2, $body);
        $this->assertArrayHasKey('message', $body[0]);
        $this->assertArrayHasKey('metadata', $body[0]);
        $this->assertArrayHasKey('createdAt', $body[0]);

        $unreadOnly = $this->getJson('/api/notifications?unreadOnly=true');
        $this->assertCount(1, $unreadOnly->json());
        $this->assertSame($unread, $unreadOnly->json()[0]['id']);

        $mark = $this->postJson("/api/notifications/{$unread}/read");
        $mark->assertOk();
        $this->assertTrue($mark->json('data.read'));

        $after = $this->getJson('/api/notifications?unreadOnly=true');
        $this->assertCount(0, $after->json());

        // read-all is idempotent.
        $this->postJson('/api/notifications/read-all')->assertOk();
        $this->getJson('/api/notifications?unreadOnly=true')->assertJsonCount(0);
    }

    public function test_api_hides_other_users_notifications(): void
    {
        $this->seedFair();
        Sanctum::actingAs($this->user());
        $mine = $this->makeNotification('Mine', false);

        $otherId = (string) Str::uuid();
        $this->createUser($otherId, 'other@test.com');
        $other = User::withoutTenantScope()->find($otherId);

        Sanctum::actingAs($other);
        $this->getJson("/api/notifications/{$mine}")
            ->assertNotFound();

        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0);
    }

    public function test_api_notification_preferences(): void
    {
        $this->seedFair();
        Sanctum::actingAs($this->user());

        $defaults = $this->getJson('/api/notification-preferences');
        $defaults->assertOk();

        $payroll = collect($defaults->json())->firstWhere('event_type', NotificationTypes::PAYROLL_RUN_COMPLETED);
        $this->assertTrue($payroll['channels']['in_app']);
        $this->assertTrue($payroll['channels']['email']);

        $update = $this->putJson('/api/notification-preferences', [
            'event_type' => NotificationTypes::PAYROLL_RUN_COMPLETED,
            'email' => false,
            'push' => true,
        ]);
        $update->assertOk();

        $after = collect($update->json())->firstWhere('event_type', NotificationTypes::PAYROLL_RUN_COMPLETED);
        $this->assertFalse($after['channels']['email']);
        $this->assertTrue($after['channels']['push']);

        $invalid = $this->putJson('/api/notification-preferences', ['event_type' => '', 'email' => 'nope']);
        $invalid->assertStatus(422);
    }

    public function test_api_push_subscriptions(): void
    {
        Sanctum::actingAs($this->user());

        $this->getJson('/api/push-subscriptions/vapid-public-key')
            ->assertOk()
            ->assertJsonPath('publicKey', null);

        config(['services.vapid.public_key' => 'vapid-public-1']);
        $this->getJson('/api/push-subscriptions/vapid-public-key')
            ->assertJsonPath('publicKey', 'vapid-public-1');

        $payload = [
            'endpoint' => 'https://push.example.test/device/1',
            'keys' => ['p256dh' => 'p256-abc', 'auth' => 'auth-xyz'],
            'userAgent' => 'TestBrowser/1.0',
        ];

        $this->postJson('/api/push-subscriptions', $payload)->assertNoContent();
        $this->postJson('/api/push-subscriptions', $payload)->assertNoContent();

        $this->assertSame(1, PushSubscription::withoutTenantScope()->count());
        $row = PushSubscription::withoutTenantScope()->first();
        $this->assertSame('p256-abc', $row->public_key);
        $this->assertSame('auth-xyz', $row->auth_token);
        $this->assertNotNull($row->last_used_at);

        $this->deleteJson('/api/push-subscriptions', ['endpoint' => 'https://push.example.test/device/1'])
            ->assertNoContent();

        $this->assertSame(0, PushSubscription::withoutTenantScope()->count());
    }

    public function test_delivery_job_requires_matching_tenant(): void
    {
        $notification = Notification::withoutTenantScope()->create([
            'tenant_id' => $this->tenantId,
            'user_id' => $this->adminId,
            'event_type' => NotificationTypes::PAYROLL_RUN_COMPLETED,
            'title' => 'Test',
            'body' => 'Body',
        ]);

        $delivery = $notification->deliveries()->withoutGlobalScopes()->create([
            'tenant_id' => $this->tenantId,
            'channel' => 'email',
            'status' => 'queued',
        ]);

        $otherTenant = (string) Str::uuid();

        // Wrong tenant → job no-ops, delivery untouched (no cross-tenant send).
        (new SendNotificationDelivery($delivery->id, $otherTenant))->handle();
        $this->assertSame('queued', $delivery->refresh()->status);
    }

    public function test_dispatcher_skipped_when_notification_schema_missing(): void
    {
        Schema::drop('notification_deliveries');
        Schema::drop('notifications');
        Schema::drop('notification_preferences');
        Schema::drop('notification_templates');

        $created = app(NotificationDispatcher::class)->notify(
            $this->tenantId,
            $this->adminId,
            NotificationTypes::PAYROLL_RUN_COMPLETED,
            ['company' => 'Acme Ltd'],
        );

        $this->assertSame([], $created);
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private function user(): User
    {
        return User::withoutTenantScope()->find($this->adminId);
    }

    private function createUser(string $id, string $email): void
    {
        DB::table('users')->insert([
            'id' => $id,
            'tenant_id' => $this->tenantId,
            'name' => $email,
            'email' => $email,
            'password' => bcrypt('password'),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedFair(): void
    {
        // Ensure global templates exist so API data is deterministic.
        (new NotificationTemplateSeeder)->run();
    }

    private function makeNotification(string $title, bool $read): string
    {
        return Notification::withoutTenantScope()->create([
            'tenant_id' => $this->tenantId,
            'user_id' => $this->adminId,
            'event_type' => NotificationTypes::PAYROLL_RUN_COMPLETED,
            'title' => $title,
            'body' => $title.' body',
            'data' => ['run_id' => $title],
            'read_at' => $read ? now() : null,
        ])->id;
    }

    private function createMinimalSchema(): void
    {
        $tables = [
            'push_subscriptions',
            'notification_deliveries',
            'notifications',
            'notification_preferences',
            'notification_templates',
            'payment_transactions',
            'compliance_reports',
            'payroll_runs',
            'companies',
            'users',
            'tenants',
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

        Schema::create('tenants', function ($table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('subdomain')->unique();
            $table->string('default_country', 2)->default('KE');
            $table->string('default_currency', 3)->default('KES');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('companies', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name');
            $table->string('country', 2)->default('KE');
            $table->string('currency', 3)->default('KES');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('users', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('payroll_runs', function ($table) {
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

        Schema::create('compliance_reports', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('company_id');
            $table->uuid('payroll_run_id')->nullable();
            $table->string('country', 2);
            $table->string('report_code');
            $table->string('report_version');
            $table->string('status')->default('generated');
            $table->timestamp('generated_at')->nullable();
            $table->json('rows')->nullable();
            $table->json('totals')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_transactions', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('invoice_id')->nullable();
            $table->string('provider');
            $table->string('provider_transaction_id')->nullable();
            $table->string('idempotency_key');
            $table->string('status');
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3);
            $table->timestamp('completed_at')->nullable();
            $table->json('provider_response')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_templates', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id')->nullable();
            $table->string('code');
            $table->string('channel');
            $table->string('subject')->nullable();
            $table->text('body');
            $table->json('variables')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'code', 'channel']);
        });

        Schema::create('notification_preferences', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('user_id');
            $table->string('event_type');
            $table->boolean('in_app')->default(true);
            $table->boolean('email')->default(true);
            $table->boolean('sms')->default(false);
            $table->boolean('push')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'event_type']);
        });

        Schema::create('notifications', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('user_id')->nullable();
            $table->uuid('template_id')->nullable();
            $table->string('event_type');
            $table->char('dedupe_hash', 64)->nullable();
            $table->string('title');
            $table->text('body');
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'user_id', 'read_at']);
            $table->unique(['tenant_id', 'dedupe_hash']);
        });

        Schema::create('notification_deliveries', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('notification_id');
            $table->string('channel');
            $table->string('status')->default('pending');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
            $table->unique(['notification_id', 'channel']);
        });

        Schema::create('push_subscriptions', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('user_id');
            $table->text('endpoint');
            $table->text('public_key')->nullable();
            $table->text('auth_token')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'endpoint']);
        });
    }
}
