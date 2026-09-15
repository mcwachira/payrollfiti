<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Services\Auth\TwoFactorAuthenticationService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class TwoFactorAuthenticationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::query()->create([
            'id' => (string) Str::uuid(),
            'name' => 'Acme Holdings',
            'slug' => (string) Str::uuid(),
            'subdomain' => (string) Str::uuid(),
            'default_country' => 'KE',
            'default_currency' => 'KES',
            'status' => 'active',
        ]);

        $this->user = User::query()->create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $this->tenant->id,
            'name' => 'Payroll Admin',
            'email' => 'admin@'.Str::uuid().'.test',
            'password' => Hash::make('Password123!'),
            'email_verified_at' => now(),
        ]);
    }

    public function test_2fa_setup_returns_secret_and_qr_code(): void
    {
        $this->actingAs($this->user, 'sanctum');

        $response = $this->postJson('/api/account/2fa/setup');

        $response->assertOk()
            ->assertJsonStructure([
                'secret',
                'qr_code_uri',
                'qr_code_svg',
            ])
            ->assertJsonPath('secret', function ($secret) {
                return preg_match('/^[A-Z2-7=]+$/', $secret) === 1;
            });
    }

    public function test_2fa_setup_is_idempotent_when_already_enabled(): void
    {
        $this->user->twoFactorAuthentication()->create([
            'tenant_id' => $this->tenant->id,
            'secret_encrypted' => encrypt('testsecret'),
            'enabled' => true,
            'confirmed_at' => now(),
        ]);

        $this->actingAs($this->user, 'sanctum');

        $this->postJson('/api/account/2fa/setup')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['2fa']);
    }

    public function test_2fa_verify_activates_and_returns_recovery_codes(): void
    {
        $this->actingAs($this->user, 'sanctum');

        $setupResponse = $this->postJson('/api/account/2fa/setup');
        $secret = $setupResponse->json('secret');

        $validCode = $this->generateTOTPCode($secret);

        $verifyResponse = $this->postJson('/api/account/2fa/verify', [
            'code' => $validCode,
        ]);

        $verifyResponse->assertOk()
            ->assertJsonStructure([
                'message',
                'recovery_codes',
            ])
            ->assertJsonCount(10, 'recovery_codes');

        $this->assertDatabaseHas('two_factor_authentications', [
            'user_id' => $this->user->id,
            'enabled' => true,
        ]);
    }

    public function test_2fa_verify_rejects_invalid_code(): void
    {
        $this->actingAs($this->user, 'sanctum');

        $this->postJson('/api/account/2fa/setup');

        $this->postJson('/api/account/2fa/verify', [
            'code' => '000000',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_login_with_2fa_requires_challenge_and_code(): void
    {
        $secret = $this->create2FASecret();

        $loginResponse = $this->postJson('/api/login', [
            'email' => $this->user->email,
            'password' => 'Password123!',
        ]);

        $loginResponse->assertStatus(202)
            ->assertJsonStructure([
                'twoFactorRequired',
                'challengeToken',
            ])
            ->assertJsonPath('twoFactorRequired', true);

        $challengeId = $loginResponse->json('challengeToken');
        $validCode = $this->generateTOTPCode($secret);

        $verifyResponse = $this->postJson('/api/account/2fa/login/verify', [
            'challenge_id' => $challengeId,
            'code' => $validCode,
        ]);

        $verifyResponse->assertOk()
            ->assertJsonPath('user.email', $this->user->email);
    }

    public function test_login_2fa_rejects_invalid_challenge_id(): void
    {
        $this->create2FASecret();

        $this->postJson('/api/login', [
            'email' => $this->user->email,
            'password' => 'Password123!',
        ]);

        $this->postJson('/api/account/2fa/login/verify', [
            'challenge_id' => 'invalid-challenge',
            'code' => '000000',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['challenge_id']);
    }

    public function test_recovery_codes_can_be_regenerated(): void
    {
        $this->create2FASecret();

        $this->actingAs($this->user, 'sanctum');

        $firstCodes = $this->postJson('/api/account/2fa/recovery-codes')
            ->assertOk()
            ->json('recovery_codes');

        $this->assertCount(10, $firstCodes);

        $secondCodes = $this->postJson('/api/account/2fa/recovery-codes')
            ->assertOk()
            ->json('recovery_codes');

        $this->assertCount(10, $secondCodes);
    }

    public function test_2fa_can_be_disabled(): void
    {
        $this->create2FASecret();

        $this->actingAs($this->user, 'sanctum');

        $this->postJson('/api/account/2fa/disable')
            ->assertOk()
            ->assertJsonPath('message', 'Two-factor authentication has been disabled.');

        $this->assertDatabaseMissing('two_factor_authentications', [
            'user_id' => $this->user->id,
            'enabled' => true,
        ]);
    }

    public function test_session_list_returns_user_sessions(): void
    {
        $this->actingAs($this->user, 'sanctum');

        $this->postJson('/api/login', [
            'email' => $this->user->email,
            'password' => 'Password123!',
        ]);

        $response = $this->getJson('/api/account/sessions');

        $response->assertOk()
            ->assertJsonStructure([
                'sessions' => [
                    '*' => [
                        'id',
                        'device',
                        'browser',
                        'ip_address',
                        'last_active_at',
                        'current',
                    ],
                ],
            ]);
    }

    public function test_session_can_be_revoked(): void
    {
        $this->actingAs($this->user, 'sanctum');

        $loginResponse = $this->postJson('/api/login', [
            'email' => $this->user->email,
            'password' => 'Password123!',
        ]);

        $sessionsResponse = $this->getJson('/api/account/sessions');
        $sessions = $sessionsResponse->json('sessions');

        $this->assertNotEmpty($sessions);

        $targetSession = collect($sessions)->firstWhere('current', false);

        if ($targetSession) {
            $this->deleteJson('/api/account/sessions/'.$targetSession['id'])
                ->assertOk()
                ->assertJsonPath('message', 'Session revoked.');
        }
    }

    public function test_destroy_others_revokes_all_except_current(): void
    {
        $this->actingAs($this->user, 'sanctum');

        $this->postJson('/api/login', [
            'email' => $this->user->email,
            'password' => 'Password123!',
        ]);

        $this->deleteJson('/api/account/sessions/others')
            ->assertOk()
            ->assertJsonPath('message', 'Other sessions revoked.');
    }

    private function create2FASecret(): string
    {
        $service = app(TwoFactorAuthenticationService::class);
        $secret = $service->generateSecret();

        $this->user->twoFactorAuthentication()->create([
            'tenant_id' => $this->user->tenant_id,
            'secret_encrypted' => encrypt($secret),
            'enabled' => true,
            'confirmed_at' => now(),
        ]);

        return $secret;
    }

    private function generateTOTPCode(string $secret): string
    {
        $service = app(TwoFactorAuthenticationService::class);

        $key = $service->base32_decode($secret);
        $timeStep = (int) floor(time() / 30);
        $timestamp = $timeStep * 30;
        $hash = hash_hmac('SHA1', pack('N', (int) ($timestamp / 4)), $key, true);
        $truncateOffset = ord(substr($hash, -1)) & 0x0F;
        $hashPart = substr($hash, $truncateOffset, 4);
        $value = unpack('N', $hashPart)[1];

        return str_pad((string) ($value % 1000000), 6, '0', STR_PAD_LEFT);
    }
}
