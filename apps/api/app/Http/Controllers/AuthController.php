<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserSession;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    private function issueToken(User $user): array
    {
        $token = $user->createToken('frontend');
        $plain = $token->plainTextToken;

        $primaryRole = match ($user->roles->first()?->name) {
            'tenant-admin' => 'ADMIN',
            'hr' => 'HR',
            'employee' => 'EMPLOYEE',
            default => strtoupper($user->roles->first()?->name ?? ''),
        };

        return [
            'accessToken' => $plain,
            'refreshToken' => $plain,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'role' => $primaryRole ?: null,
                'tenantId' => $user->tenant_id,
                'employeeId' => $user->employee?->id ?? null,
                'twoFactorEnabled' => (bool) $user->twoFactorAuthentication?->enabled,
            ],
            'tenant_id' => $user->tenant_id,
        ];
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $emailKey = strtolower((string) $validated['email']);
        $rateKey = 'auth:login:'.md5($emailKey.'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($rateKey, 5)) {
            throw ValidationException::withMessages([
                'email' => ['Too many login attempts. Please wait a minute and try again.'],
            ]);
        }

        $user = User::query()->withoutTenantScope()->where('email', $emailKey)->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($rateKey, 60);

            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        if ($this->isTwoFactorAuthenticationEnabled($user->id)) {
            $challengeId = (string) Str::uuid();

            $request->session()->put('2fa_challenge_id', $challengeId);
            $request->session()->put('2fa_challenge_user_id', $user->id);

            return response()->json([
                'twoFactorRequired' => true,
                'challengeToken' => $challengeId,
            ], 202);
        }

        Auth::guard('web')->login($user, (bool) $request->boolean('remember'));
        $request->session()->regenerate();
        TenantContext::set($user->tenant_id);

        UserSession::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'session_hash' => hash('sha256', $request->session()->getId()),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'last_active_at' => now(),
            'expires_at' => now()->addDays(30),
        ]);

        RateLimiter::clear($rateKey);

        return response()->json($this->issueToken($user));
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user) {
            $token = $user->currentAccessToken();

            if ($token) {
                $token->delete();
            }
        }

        Auth::guard('web')->logout($request);
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request)
    {
        $user = $request->user()?->load('roles', 'employee', 'twoFactorAuthentication');

        if (!$user) {
            return response()->json(null);
        }

        $primaryRole = match ($user->roles->first()?->name) {
            'tenant-admin' => 'ADMIN',
            'hr' => 'HR',
            'employee' => 'EMPLOYEE',
            default => strtoupper($user->roles->first()?->name ?? ''),
        };

        return response()->json([
            'id' => $user->id,
            'email' => $user->email,
            'role' => $primaryRole ?: null,
            'tenantId' => $user->tenant_id,
            'employeeId' => $user->employee?->id ?? null,
            'twoFactorEnabled' => (bool) $user->twoFactorAuthentication?->enabled,
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);

        $status = Password::sendResetLink($request->only('email'));

        return $status === Password::RESET_LINK_SENT
            ? response()->json(['message' => 'Password reset link sent.'])
            : response()->json(['message' => 'Unable to send reset link.'], 400);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->password = $password;
                $user->save();

                $user->userSessions()->whereNull('revoked_at')->update(['revoked_at' => now()]);
            }
        );

        return $status === Password::PASSWORD_RESET
            ? response()->json(['message' => 'Password reset successfully. Please log in.'])
            : response()->json(['message' => 'Unable to reset password.'], 400);
    }

    public function signup(Request $request)
    {
        $validated = $request->validate([
            'tenantName' => ['required', 'string', 'max:255'],
            'countryCode' => ['required', 'string', 'size:2'],
            'adminEmail' => ['required', 'email', 'max:255'],
            'adminPassword' => ['required', 'string', 'min:8'],
        ]);

        $baseSlug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $validated['tenantName']), '-'));

        $maxAttempts = 10;
        $attempt = 0;

        while (true) {
            try {
                [$tenant, $user] = DB::transaction(function () use ($validated, $baseSlug, $attempt, $request) {
                    $slug = $attempt === 0 ? $baseSlug : $baseSlug . '-' . ($attempt + 1);
                    $subdomain = $attempt === 0 ? $baseSlug : $baseSlug . '-' . ($attempt + 1);

                    $tenant = Tenant::create([
                        'name' => $validated['tenantName'],
                        'slug' => $slug,
                        'subdomain' => $subdomain,
                        'default_country' => $validated['countryCode'],
                        'default_currency' => strtoupper($validated['countryCode']) === 'NG' ? 'NGN' : (strtoupper($validated['countryCode']) === 'ZA' ? 'ZAR' : 'KES'),
                        'status' => 'active',
                    ]);

                    $company = $tenant->companies()->create([
                        'name' => $validated['tenantName'],
                        'country' => $validated['countryCode'],
                        'currency' => strtoupper($validated['countryCode']) === 'NG' ? 'NGN' : (strtoupper($validated['countryCode']) === 'ZA' ? 'ZAR' : 'KES'),
                        'status' => 'active',
                    ]);

                    $user = new User([
                        'tenant_id' => $tenant->id,
                        'email' => $validated['adminEmail'],
                        'password' => $validated['adminPassword'],
                        'name' => $validated['adminEmail'],
                        'status' => 'active',
                    ]);
                    $user->save();

                    $adminRole = \Spatie\Permission\Models\Role::where('name', 'admin')->first();
                    if ($adminRole) {
                        $user->assignRole($adminRole);
                    }

                    Auth::guard('web')->login($user, true);
                    $request->session()->regenerate();
                    TenantContext::set($tenant->id);

                    UserSession::create([
                        'tenant_id' => $tenant->id,
                        'user_id' => $user->id,
                        'session_hash' => hash('sha256', $request->session()->getId()),
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->userAgent(),
                        'last_active_at' => now(),
                        'expires_at' => now()->addDays(30),
                    ]);

                    return [$tenant, $user];
                });

                return response()->json($this->issueToken($user));
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                $attempt++;

                if ($attempt >= $maxAttempts) {
                    throw ValidationException::withMessages([
                        'tenantName' => 'Unable to create workspace. Please try a different name.',
                    ]);
                }

                continue;
            }
        }
    }

    public function acceptInvite(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $invitation = Invitation::where('token_hash', hash('sha256', $validated['token']))
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->firstOrFail();

        $user = User::where('email', $invitation->email)
            ->where('tenant_id', $invitation->tenant_id)
            ->firstOrFail();

        $user->password = $validated['password'];
        $user->save();

        $invitation->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        Auth::guard('web')->login($user, true);
        $request->session()->regenerate();
        TenantContext::set($invitation->tenant_id);

        UserSession::create([
            'tenant_id' => $invitation->tenant_id,
            'user_id' => $user->id,
            'session_hash' => hash('sha256', $request->session()->getId()),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'last_active_at' => now(),
            'expires_at' => now()->addDays(30),
        ]);

        return response()->json($this->issueToken($user));
    }

    public function refresh(Request $request)
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'No token provided'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($token);

        if (! $accessToken || $accessToken->expires_at?->isPast()) {
            return response()->json(['message' => 'Invalid or expired token'], 401);
        }

        $user = $accessToken->tokenable;

        if (! $user instanceof User) {
            return response()->json(['message' => 'Invalid token'], 401);
        }

        $accessToken->delete();

        return response()->json($this->issueToken($user));
    }

    /**
     * Check if two-factor authentication is enabled for a user.
     */
    protected function isTwoFactorAuthenticationEnabled(string $userId): bool
    {
        return optional(User::query()->withoutTenantScope()->find($userId))->twoFactorAuthentication?->enabled ?? false;
    }
}
