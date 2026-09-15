<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserSession;
use App\Services\Auth\TwoFactorAuthenticationService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Controller for handling Two-Factor Authentication (2FA) and session management.
 *
 * Implements Part 17: 2FA & Session Management from the PayrollFiti Build Guide.
 *
 * @see https://tools.ietf.org/html/rfc6238 TOTP Algorithm
 */
class TwoFactorAuthenticationController extends Controller
{
    /**
     * TwoFactorAuthenticationService instance.
     *
     * @var TwoFactorAuthenticationService
     */
    protected $twoFactorService;

    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function __construct(TwoFactorAuthenticationService $twoFactorService)
    {
        $this->twoFactorService = $twoFactorService;
    }

    /**
     * Initiate 2FA setup process.
     *
     * Generates a TOTP secret and returns QR code for setup.
     * The secret is stored as PENDING until verified.
     *
     * @return JsonResponse
     */
    public function setup(Request $request)
    {
        $user = $request->user();

        // Check if 2FA is already enabled
        if ($this->twoFactorService->isTwoFactorAuthenticationEnabled($user->id)) {
            throw ValidationException::withMessages([
                '2fa' => ['Two-factor authentication is already enabled for this account.'],
            ]);
        }

        // Generate a new secret
        $secret = $this->twoFactorService->generateSecret();

        // Generate QR code URI
        $qrCodeUri = $this->twoFactorService->getQrCodeUri($user->email, $secret);

        // Generate SVG QR code
        try {
            $qrCodeSvg = $this->twoFactorService->getQrCodeSvg($qrCodeUri);
        } catch (\Exception $e) {
            Log::error('Failed to generate QR code for 2FA setup', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            throw ValidationException::withMessages([
                '2fa' => ['Unable to generate QR code. Please try again.'],
            ]);
        }

        // Store the secret encrypted in the user's session temporarily
        // It will be moved to permanent storage after verification
        $request->session()->put('2fa_setup_secret', Crypt::encryptString($secret));
        $request->session()->put('2fa_setup_email', $user->email);

        return response()->json([
            'secret' => $secret,
            'qr_code_uri' => $qrCodeUri,
            'qr_code_svg' => $qrCodeSvg,
        ]);
    }

    /**
     * Verify and activate 2FA setup.
     *
     * Validates the TOTP code provided by the user and, if correct,
     * activates 2FA and generates recovery codes.
     *
     * @return JsonResponse
     */
    public function verify(Request $request)
    {
        $user = $request->user();

        // Validate input
        $validated = $request->validate([
            'code' => ['required', 'string', 'regex:/^[0-9]{6}$/'],
        ]);

        // Get the pending secret from session
        $encryptedSecret = $request->session()->get('2fa_setup_secret');
        $setupEmail = $request->session()->get('2fa_setup_email');

        if (! $encryptedSecret || ! $setupEmail || $setupEmail !== $user->email) {
            throw ValidationException::withMessages([
                'code' => ['Invalid or expired 2FA setup session. Please start the setup process again.'],
            ]);
        }

        // Decrypt the secret
        $secret = Crypt::decryptString($encryptedSecret);

        // Verify the TOTP code
        if (! $this->twoFactorService->verifyCode($secret, $validated['code'])) {
            throw ValidationException::withMessages([
                'code' => ['Invalid verification code. Please check your authenticator app and try again.'],
            ]);
        }

        // Generate recovery codes
        $recoveryCodes = $this->twoFactorService->generateRecoveryCodes();

        // Activate 2FA for the user
        $this->twoFactorService->enableTwoFactorAuthentication($user->id, $secret);

        // Store the recovery codes
        $this->twoFactorService->storeRecoveryCodes($user->id, $recoveryCodes);

        // Clear the session data
        $request->session()->forget(['2fa_setup_secret', '2fa_setup_email']);

        return response()->json([
            'message' => 'Two-factor authentication has been successfully enabled.',
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Handle 2FA verification during login.
     *
     * This is the second step of the login process when 2FA is enabled.
     *
     * @return JsonResponse
     */
    public function loginVerify(Request $request)
    {
        $request->validate([
            'challenge_id' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        $challengeId = $request->input('challenge_id');
        $storedChallengeId = $request->session()->get('2fa_challenge_id');
        $storedUserId = $request->session()->get('2fa_challenge_user_id');

        if (! $storedChallengeId || ! $storedUserId || ! hash_equals((string) $storedChallengeId, (string) $challengeId)) {
            throw ValidationException::withMessages([
                'challenge_id' => ['Invalid or expired login challenge.'],
            ]);
        }

        $user = User::query()->withoutTenantScope()->whereKey($storedUserId)->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'challenge_id' => ['Invalid or expired login challenge.'],
            ]);
        }

        if (! $this->twoFactorService->isTwoFactorAuthenticationEnabled($user->id)) {
            throw ValidationException::withMessages([
                'code' => ['Two-factor authentication is not enabled for this account.'],
            ]);
        }

        $code = $request->input('code');
        $rateKey = 'auth:2fa:'.md5($user->id.'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($rateKey, 5)) {
            throw ValidationException::withMessages([
                'code' => ['Too many failed 2FA attempts. Please wait a minute and try again.'],
            ]);
        }

        $secret = $this->twoFactorService->getDecryptedSecret($user->id);

        if (! $secret) {
            throw ValidationException::withMessages([
                'code' => ['Two-factor authentication is not properly configured. Please contact support.'],
            ]);
        }

        $isValid = $this->twoFactorService->verifyCode($secret, $code)
            || $this->twoFactorService->useRecoveryCode($user->id, $code);

        if (! $isValid) {
            RateLimiter::hit($rateKey, 60);

            throw ValidationException::withMessages([
                'code' => ['Invalid verification code. Please check your authenticator app and try again.'],
            ]);
        }

        RateLimiter::clear($rateKey);

        $request->session()->forget(['2fa_challenge_id', '2fa_challenge_user_id']);

        Auth::guard('web')->login($user, (bool) $request->boolean('remember'));
        $request->session()->regenerate();

        TenantContext::set($user->tenant_id);
        $this->recordSession($request, $user);

        $token = $user->createToken('frontend');
        $plain = $token->plainTextToken;

        return response()->json([
            'user' => $user->load('roles', 'tenant'),
            'tenant_id' => $user->tenant_id,
            'accessToken' => $plain,
            'refreshToken' => $plain,
        ]);
    }

    /**
     * Disable 2FA for the current user.
     *
     * @return JsonResponse
     */
    public function disable(Request $request)
    {
        $user = $request->user();

        $this->twoFactorService->disableTwoFactorAuthentication($user->id);

        return response()->json([
            'message' => 'Two-factor authentication has been disabled.',
        ]);
    }

    /**
     * Get recovery codes (for re-generation).
     *
     * @return JsonResponse
     */
    public function recoveryCodes(Request $request)
    {
        $user = $request->user();

        // Check if 2FA is enabled
        if (! $this->twoFactorService->isTwoFactorAuthenticationEnabled($user->id)) {
            throw ValidationException::withMessages([
                '2fa' => ['Two-factor authentication is not enabled for this account.'],
            ]);
        }

        // Generate new recovery codes
        $recoveryCodes = $this->twoFactorService->generateRecoveryCodes();

        // Store the new recovery codes (this will invalidate old ones)
        $this->twoFactorService->storeRecoveryCodes($user->id, $recoveryCodes);

        return response()->json([
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Check if two-factor authentication is enabled for the current user.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $this->twoFactorService->isTwoFactorAuthenticationEnabled($user->id),
        ]);
    }

    /**
     * Record user session for tracking.
     */
    protected function recordSession(Request $request, User $user): void
    {
        if (! app()->runningInConsole()) {
            UserSession::query()->updateOrCreate([
                'user_id' => $user->id,
                'session_hash' => hash('sha256', $request->session()->getId()),
            ], [
                'tenant_id' => $user->tenant_id,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'last_active_at' => now(),
                'expires_at' => now()->addDays(30),
                'revoked_at' => null,
            ]);
        }
    }
}
