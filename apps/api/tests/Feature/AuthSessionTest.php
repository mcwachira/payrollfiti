<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_valid_credentials(): void
    {
        $token = 'test-csrf-token';

        $tenant = Tenant::query()->create([
            'id' => '11111111-1111-1111-1111-111111111111',
            'name' => 'Acme',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
            'status' => 'active',
        ]);

        $email = 'admin@'.Str::uuid().'.test';

        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'email' => $email,
            'password' => Hash::make('Password123!'),
        ]);

        $response = $this->withSession(['_token' => $token])
            ->withCookie('XSRF-TOKEN', $token)
            ->withHeaders([
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ])
            ->postJson('/api/login', [
                '_token' => $token,
                'email' => $email,
                'password' => 'Password123!',
            ]);

        if ($response->getStatusCode() !== 200) {
            file_put_contents('/tmp/login_debug.txt', $response->getContent());
        }

        $response->assertOk();
        $response->assertJsonPath('tenant_id', $tenant->id);
        $this->assertAuthenticatedAs($user);
    }

    public function test_user_cannot_login_with_invalid_credentials(): void
    {
        $token = 'test-csrf-token';

        $tenant = Tenant::query()->create([
            'id' => '22222222-2222-2222-2222-222222222222',
            'name' => 'Beta',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
            'status' => 'active',
        ]);

        User::factory()->create([
            'tenant_id' => $tenant->id,
            'email' => 'login@beta.test',
            'password' => Hash::make('Password123!'),
        ]);

        $this->withSession(['_token' => $token])
            ->withCookie('XSRF-TOKEN', $token)
            ->withHeaders([
                'X-CSRF-TOKEN' => $token,
                'X-XSRF-TOKEN' => $token,
            ])
            ->postJson('/api/login', [
                '_token' => $token,
                'email' => 'login@beta.test',
                'password' => 'WrongPassword',
            ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_login_still_validates_credentials_without_csrf_token_under_test_env(): void
    {
        $app = app();
        error_log('runningUnitTests: ' . ($app->runningUnitTests() ? 'yes' : 'no'));
        error_log('APP_ENV: ' . getenv('APP_ENV'));
        error_log('app env: ' . $app->environment());

        $this->postJson('/api/login', [
            'email' => 'login@beta.test',
            'password' => 'WrongPassword',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }
}
