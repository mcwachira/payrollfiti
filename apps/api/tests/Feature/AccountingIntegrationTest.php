<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AccountingConnection;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class AccountingIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private string $tenantId;

    private string $adminId;

    private User $admin;

    private string $companyId;

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

        $this->companyId = (string) Str::uuid();

        Company::query()->create([
            'id' => $this->companyId,
            'tenant_id' => $this->tenantId,
            'name' => 'Acme Kenya Ltd',
            'country' => 'KE',
            'currency' => 'KES',
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

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        DB::table('permissions')->updateOrInsert(
            ['name' => 'accounting.view'],
            ['id' => (string) Str::uuid(), 'slug' => 'accounting.view', 'domain' => 'accounting', 'guard_name' => 'web'],
        );
        DB::table('permissions')->updateOrInsert(
            ['name' => 'accounting.manage'],
            ['id' => (string) Str::uuid(), 'slug' => 'accounting.manage', 'domain' => 'accounting', 'guard_name' => 'web'],
        );

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->admin->givePermissionTo('accounting.view', 'accounting.manage');
    }

    public function test_accounting_connection_crud_cycle(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $response = $this->postJson('/api/v1/settings/accounting/connections', [
            'company_id' => $this->companyId,
            'provider' => 'xero',
            'metadata' => ['notes' => 'Test connection'],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.provider', 'xero')
            ->assertJsonPath('data.status', 'active');

        $connectionId = $response->json('data.id');

        $this->getJson('/api/v1/settings/accounting/connections')
            ->assertOk()
            ->assertJsonCount(1);

        $this->getJson("/api/v1/settings/accounting/connections/{$connectionId}")
            ->assertOk()
            ->assertJsonPath('data.provider', 'xero');

        $this->putJson("/api/v1/settings/accounting/connections/{$connectionId}", [
            'status' => 'disabled',
        ])->assertOk()
            ->assertJsonPath('data.status', 'disabled');

        $this->deleteJson("/api/v1/settings/accounting/connections/{$connectionId}")->assertNoContent();

        $this->assertDatabaseHas('accounting_connections', ['id' => $connectionId, 'status' => 'disabled']);
    }

    public function test_oauth_redirect_returns_provider_url(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $token = 'test-csrf-token';

        $response = $this->withSession(['_token' => $token])
            ->withCookie('XSRF-TOKEN', $token)
            ->withHeaders([
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ])
            ->postJson('/api/v1/settings/accounting/connections/xero/oauth/redirect', [
                '_token' => $token,
                'company_id' => $this->companyId,
            ]);

        $response->assertOk()
            ->assertJsonStructure(['redirect_url']);

        $redirectUrl = $response->json('redirect_url');

        $this->assertIsString($redirectUrl);
        $this->assertNotEmpty($redirectUrl);
    }

    public function test_oauth_redirect_requires_company_id(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $token = 'test-csrf-token';

        $this->withSession(['_token' => $token])
            ->withCookie('XSRF-TOKEN', $token)
            ->withHeaders([
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ])
            ->postJson('/api/v1/settings/accounting/connections/xero/oauth/redirect', [
                '_token' => $token,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['company_id']);
    }

    public function test_cross_tenant_access_denied(): void
    {
        $otherTenantId = (string) Str::uuid();
        $otherUserId = (string) Str::uuid();

        Tenant::query()->create([
            'id' => $otherTenantId,
            'name' => 'Other Ltd',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'NG',
            'default_currency' => 'NGN',
            'status' => 'active',
        ]);

        $otherUser = User::query()->create([
            'id' => $otherUserId,
            'tenant_id' => $otherTenantId,
            'name' => 'Other Admin',
            'email' => 'other@test.com',
            'password' => Hash::make('Password123!'),
            'email_verified_at' => now(),
        ]);

        $otherUser->givePermissionTo('accounting.view', 'accounting.manage');

        $otherCompanyId = (string) Str::uuid();

        Company::query()->create([
            'id' => $otherCompanyId,
            'tenant_id' => $otherTenantId,
            'name' => 'Other Company',
            'country' => 'NG',
            'currency' => 'NGN',
            'status' => 'active',
        ]);

        $connection = AccountingConnection::query()->create([
            'tenant_id' => $otherTenantId,
            'company_id' => $otherCompanyId,
            'provider' => 'xero',
            'status' => 'active',
        ]);

        $this->actingAs($otherUser, 'sanctum');

        $this->getJson('/api/v1/settings/accounting/connections')
            ->assertOk()
            ->assertJsonCount(1);

        $this->getJson("/api/v1/settings/accounting/connections/{$connection->id}")
            ->assertOk();

        $this->actingAs($this->admin, 'sanctum');

        $this->getJson("/api/v1/settings/accounting/connections/{$connection->id}")
            ->assertStatus(404);

        $this->putJson("/api/v1/settings/accounting/connections/{$connection->id}", [
            'status' => 'disabled',
        ])->assertStatus(404);

        $this->deleteJson("/api/v1/settings/accounting/connections/{$connection->id}")
            ->assertStatus(404);
    }

    public function test_user_without_permission_cannot_access_connections(): void
    {
        $regularUserId = (string) Str::uuid();

        $regularUser = User::query()->create([
            'id' => $regularUserId,
            'tenant_id' => $this->tenantId,
            'name' => 'Regular User',
            'email' => 'regular@test.com',
            'password' => Hash::make('Password123!'),
            'email_verified_at' => now(),
        ]);

        $this->actingAs($regularUser, 'sanctum');

        $this->getJson('/api/v1/settings/accounting/connections')
            ->assertStatus(403);
    }

    public function test_sync_jobs_are_listed_for_connection(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $connection = AccountingConnection::query()->create([
            'tenant_id' => $this->tenantId,
            'company_id' => $this->companyId,
            'provider' => 'quickbooks',
            'status' => 'active',
        ]);

        $this->getJson("/api/v1/settings/accounting/connections/{$connection->id}/sync-jobs")
            ->assertOk()
            ->assertJsonCount(0);
    }
}
