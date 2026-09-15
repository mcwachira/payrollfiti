<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountingConnection;
use App\Models\Company;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;

class AccountingOAuthController extends Controller
{
    public function redirect(Request $request, string $provider): JsonResponse
    {
        $request->validate([
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
        ]);

        $user = $request->user();

        $company = Company::query()
            ->where('id', $request->input('company_id'))
            ->where('tenant_id', $user->tenant_id)
            ->firstOrFail();

        $this->authorize('create', [AccountingConnection::class, $company]);

        session([
            'accounting_oauth' => [
                'tenant_id' => $user->tenant_id,
                'company_id' => $company->id,
                'provider' => $provider,
            ],
        ]);

        $driver = match ($provider) {
            'xero' => 'xero',
            'quickbooks' => 'quickbooks',
            'zoho_books' => 'zoho-books',
            default => throw new \InvalidArgumentException("Unsupported provider [{$provider}]."),
        };

        $redirectUrl = Socialite::driver($driver)->redirect()->getTargetUrl();

        return response()->json([
            'redirect_url' => $redirectUrl,
        ]);
    }

    public function callback(Request $request, string $provider): JsonResponse
    {
        $oauth = session('accounting_oauth');

        if ($oauth === null || $oauth['provider'] !== $provider) {
            return response()->json(['error' => 'Invalid OAuth session.'], 400);
        }

        $user = $request->user();

        if ($user === null || $user->tenant_id !== $oauth['tenant_id']) {
            return response()->json(['error' => 'Unauthorized.'], 401);
        }

        $driver = match ($provider) {
            'xero' => 'xero',
            'quickbooks' => 'quickbooks',
            'zoho_books' => 'zoho-books',
            default => throw new \InvalidArgumentException("Unsupported provider [{$provider}]."),
        };

        try {
            $socialiteUser = Socialite::driver($driver)->user();
        } catch (\Throwable $e) {
            return response()->json(['error' => 'OAuth callback failed: '.$e->getMessage()], 400);
        }

        $connection = AccountingConnection::withoutTenantScope()
            ->where('tenant_id', $oauth['tenant_id'])
            ->where('company_id', $oauth['company_id'])
            ->where('provider', $provider)
            ->first();

        if ($connection === null) {
            $connection = AccountingConnection::create([
                'tenant_id' => $oauth['tenant_id'],
                'company_id' => $oauth['company_id'],
                'provider' => $provider,
                'status' => 'active',
                'access_token_encrypted' => encrypt($socialiteUser->token),
                'refresh_token_encrypted' => encrypt($socialiteUser->refreshToken),
                'token_expires_at' => $socialiteUser->expiresIn ? now()->addSeconds($socialiteUser->expiresIn) : null,
                'external_account_id' => $socialiteUser->id,
                'metadata' => $socialiteUser->user ? ['name' => $socialiteUser->user['name'] ?? null] : [],
            ]);
        } else {
            $connection->update([
                'access_token_encrypted' => encrypt($socialiteUser->token),
                'refresh_token_encrypted' => encrypt($socialiteUser->refreshToken),
                'token_expires_at' => $socialiteUser->expiresIn ? now()->addSeconds($socialiteUser->expiresIn) : null,
                'external_account_id' => $socialiteUser->id,
                'status' => 'active',
            ]);
        }

        session()->forget('accounting_oauth');

        return (new AccountingConnectionResource($connection->load('company')))->response();
    }
}
