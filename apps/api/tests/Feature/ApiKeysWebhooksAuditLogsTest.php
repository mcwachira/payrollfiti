<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ApiKey;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ApiKeysWebhooksAuditLogsTest extends TestCase
{
    private string $tenantId;

    private string $adminId;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantId = (string) Str::uuid();

        Tenant::query()->create([
            'id' => $this->tenantId,
            'name' => 'Acme Ltd',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
            'status' => 'active',
        ]);

        $this->adminId = (string) Str::uuid();

        $this->admin = User::query()->create([
            'id' => $this->adminId,
            'tenant_id' => $this->tenantId,
            'name' => 'Admin',
            'email' => 'admin@test.com',
            'password' => Hash::make('Password123!'),
            'email_verified_at' => now(),
        ]);

        foreach (['api-keys.view', 'api-keys.manage', 'webhooks.view', 'webhooks.manage', 'audit.view'] as $permission) {
            if (! Permission::where('name', $permission)->exists()) {
                $model = new Permission([
                    'name' => $permission,
                    'slug' => $permission,
                    'domain' => explode('.', $permission)[0],
                    'guard_name' => 'web',
                ]);
                $model->id = (string) Str::uuid();
                $model->save();
            }
        }

        $this->admin->givePermissionTo('api-keys.view', 'api-keys.manage', 'webhooks.view', 'webhooks.manage', 'audit.view');
    }

    public function test_api_key_crud_cycle(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/v1/settings/api-keys', [
            'name' => 'Integration Key',
            'permissions' => ['employees:read', 'payroll:read'],
            'expires_at' => now()->addYear()->toDateString(),
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['id', 'name', 'prefix', 'plain_secret'])
            ->assertJsonPath('name', 'Integration Key')
            ->assertJsonCount(2, 'permissions');

        $apiKeyId = $response->json('id');
        $plainSecret = $response->json('plain_secret');

        $this->assertNotNull($plainSecret);
        $this->assertStringStartsWith('pf_', $plainSecret);

        $this->getJson('/api/v1/settings/api-keys')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/v1/settings/api-keys/{$apiKeyId}")
            ->assertOk()
            ->assertJsonPath('name', 'Integration Key');

        $this->putJson("/v1/settings/api-keys/{$apiKeyId}", [
            'name' => 'Updated Key',
            'status' => 'revoked',
        ])->assertOk()
            ->assertJsonPath('name', 'Updated Key')
            ->assertJsonPath('status', 'revoked');

        $this->deleteJson("/v1/settings/api-keys/{$apiKeyId}")->assertNoContent();

        $this->assertDatabaseMissing('api_keys', ['id' => $apiKeyId, 'status' => 'active']);
    }

    public function test_api_key_regenerate_returns_new_secret(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $apiKey = ApiKey::query()->create([
            'tenant_id' => $this->tenantId,
            'created_by' => $this->admin->id,
            'name' => 'Rotate Key',
            'prefix' => 'pf_'.substr(hash('sha256', 'old-secret'), 0, 8),
            'secret_hash' => Hash::make('old-secret'),
            'status' => 'active',
        ]);

        $this->postJson("/api/v1/settings/api-keys/{$apiKey->id}/regenerate")
            ->assertOk()
            ->assertJsonPath('plain_secret', fn ($secret) => is_string($secret) && str_starts_with($secret, 'pf_'));

        $this->assertDatabaseHas('api_keys', ['id' => $apiKey->id, 'status' => 'active']);
    }

    public function test_webhook_endpoint_crud_cycle(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/v1/settings/webhook-endpoints', [
            'name' => 'Payroll Events',
            'url' => 'https://example.com/webhooks',
            'secret' => 'whsec_1234567890',
            'events' => ['payroll_run.completed', 'payment.settled'],
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['id', 'name', 'url', 'events'])
            ->assertJsonPath('events.0', 'payroll_run.completed');

        $endpointId = $response->json('id');

        $this->getJson('/api/v1/settings/webhook-endpoints')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/v1/settings/webhook-endpoints/{$endpointId}")
            ->assertOk()
            ->assertJsonPath('name', 'Payroll Events');

        $this->putJson("/api/v1/settings/webhook-endpoints/{$endpointId}", [
            'name' => 'Renamed',
            'events' => ['payment.settled'],
        ])->assertOk()
            ->assertJsonPath('events.0', 'payment.settled');

        $this->deleteJson("/api/v1/settings/webhook-endpoints/{$endpointId}")->assertNoContent();

        $this->assertDatabaseHas('webhook_endpoints', ['id' => $endpointId, 'status' => 'disabled']);
    }

    public function test_audit_logs_are_indexed_and_filterable(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $employee = Employee::query()->create([
            'tenant_id' => $this->tenantId,
            'company_id' => null,
            'employee_number' => 'EMP-001',
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => 'test@test.com',
            'country' => 'KE',
            'hire_date' => now()->toDateString(),
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => Employee::class,
            'auditable_id' => $employee->id,
            'action' => 'created',
        ]);

        $this->getJson('/api/v1/settings/audit-logs')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'action', 'auditable_type', 'auditable_id']]]);

        $this->getJson('/api/v1/settings/audit-logs?action=created')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
