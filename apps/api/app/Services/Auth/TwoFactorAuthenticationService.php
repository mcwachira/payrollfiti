<?php

namespace App\Services\Auth;

use App\Models\RecoveryCode;
use App\Models\TwoFactorAuthentication;
use App\Models\User;
use BaconQrCode\Exception\ExceptionInterface as BaconQrException;
use BaconQrCode\NotFoundException;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

/**
 * Service for handling Two-Factor Authentication (TOTP) operations.
 *
 * Implements RFC 6238 Time-Based One-Time Password algorithm.
 *
 * @see https://tools.ietf.org/html/rfc6238
 */
class TwoFactorAuthenticationService
{
    /**
     * Generate a new TOTP secret key.
     *
     * @return string Base32 encoded secret key
     */
    public function generateSecret(): string
    {
        // Generate a 16-byte random secret (128 bits)
        $bytes = random_bytes(16);

        // Convert to Base32 (RFC 4648)
        return $this->base32_encode($bytes);
    }

    /**
     * Generate provisioning URI for QR code.
     *
     * @param  string  $email  User's email address
     * @param  string  $secret  Base32 encoded secret key
     * @param  string  $issuer  Issuer name (default: PayrollFiti)
     * @return string Provisioning URI
     */
    public function getQrCodeUri(string $email, string $secret, string $issuer = 'PayrollFiti'): string
    {
        // URL encode the parameters
        $encodedEmail = urlencode($email);
        $encodedIssuer = urlencode($issuer);

        // Construct the otpauth:// URI
        return sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            $encodedIssuer,
            $encodedEmail,
            urlencode($secret),
            $encodedIssuer
        );
    }

    /**
     * Generate SVG QR code image.
     *
     * @param  string  $uri  Provisioning URI
     * @return string SVG QR code content
     *
     * @throws BaconQrException
     */
    public function getQrCodeSvg(string $uri): string
    {
        try {
            $renderer = new ImageRenderer(
                new RendererStyle(4, 4),
                new SvgImageBackEnd
            );

            $writer = new Writer($renderer);

            return $writer->writeString($uri);
        } catch (NotFoundException $e) {
            throw new \RuntimeException('SVG renderer not found', 0, $e);
        } catch (BaconQrException $e) {
            throw new \RuntimeException('Error generating QR code', 0, $e);
        }
    }

    /**
     * Verify a TOTP code against a secret.
     *
     * @param  string  $secret  Base32 encoded secret key
     * @param  string  $code  Six-digit TOTP code to verify
     * @param  int  $window  Number of time steps to check before/after current (default: 1)
     * @return bool True if code is valid
     */
    public function verifyCode(string $secret, string $code, int $window = 1): bool
    {
        // Clean the code (remove spaces)
        $code = str_replace(' ', '', $code);

        // Validate code format
        if (! preg_match('/^[0-9]{6}$/', $code)) {
            return false;
        }

        // Decode the Base32 secret
        $key = $this->base32_decode($secret);
        if ($key === null) {
            return false;
        }

        // Get current time step
        $timeStep = floor(time() / 30);

        // Check current window and window steps before/after
        for ($offset = -$window; $offset <= $window; $offset++) {
            $timestamp = ($timeStep + $offset) * 30;
            $hash = hash_hmac('SHA1', pack('N', $timestamp / 4), $key, true);

            // Extract 4 bytes from the hash
            $truncateOffset = ord(substr($hash, -1)) & 0x0F;
            $hashPart = substr($hash, $truncateOffset, 4);

            // Unpack as unsigned long (always 32 bit, big endian)
            $value = unpack('N', $hashPart)[1];

            // Get the 6-digit code
            $generatedCode = str_pad($value % 1000000, 6, '0', STR_PAD_LEFT);

            if (hash_equals($code, $generatedCode)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate recovery codes.
     *
     * @param  int  $count  Number of recovery codes to generate (default: 10)
     * @return array Array of plain recovery codes
     */
    public function generateRecoveryCodes(int $count = 10): array
    {
        $codes = [];

        for ($i = 0; $i < $count; $i++) {
            // Generate a 16-character alphanumeric code
            $code = Str::upper(Str::random(16));
            $codes[] = $code;
        }

        return $codes;
    }

    /**
     * Hash a recovery code for storage.
     *
     * @param  string  $code  Plain recovery code
     * @return string Hashed recovery code (bcrypt)
     */
    public function hashRecoveryCode(string $code): string
    {
        return password_hash($code, PASSWORD_BCRYPT);
    }

    /**
     * Check if a recovery code is valid.
     *
     * @param  string  $code  Plain recovery code to check
     * @param  string  $hashedCode  Hashed recovery code from database
     * @return bool True if code matches
     */
    public function checkRecoveryCode(string $code, string $hashedCode): bool
    {
        return password_verify($code, $hashedCode);
    }

    /**
     * Enable 2FA for a user.
     *
     * @param  int  $userId  User ID
     * @param  string  $secret  Base32 encoded secret key
     */
    public function enableTwoFactorAuthentication(string $userId, string $secret): void
    {
        $user = User::find($userId);
        $tenantId = $user?->tenant_id;

        // Encrypt the secret for storage
        $encryptedSecret = Crypt::encryptString($secret);

        // Update or create the 2FA record
        TwoFactorAuthentication::updateOrCreate(
            ['user_id' => $userId],
            [
                'tenant_id' => $tenantId,
                'secret_encrypted' => $encryptedSecret,
                'enabled' => true,
                'confirmed_at' => now(),
            ]
        );
    }

    /**
     * Disable 2FA for a user.
     *
     * @param  int  $userId  User ID
     */
    public function disableTwoFactorAuthentication(string $userId): void
    {
        $twoFa = TwoFactorAuthentication::where('user_id', $userId)->first();

        if ($twoFa) {
            $twoFa->delete();
        }

        // Delete associated recovery codes
        RecoveryCode::whereHas('twoFactorAuthentication', function ($query) use ($userId) {
            $query->where('user_id', $userId);
        })->delete();
    }

    /**
     * Check if 2FA is enabled for a user.
     *
     * @param  string  $userId  User ID
     * @return bool True if 2FA is enabled
     */
    public function isTwoFactorAuthenticationEnabled(string $userId): bool
    {
        return TwoFactorAuthentication::where('user_id', $userId)
            ->where('enabled', true)
            ->exists();
    }

    /**
     * Get the encrypted secret for a user.
     *
     * @param  int  $userId  User ID
     * @return string|null Encrypted secret or null if not set
     */
    public function getEncryptedSecret(string $userId): ?string
    {
        return TwoFactorAuthentication::where('user_id', $userId)
            ->value('secret_encrypted');
    }

    /**
     * Decrypt the secret for a user.
     *
     * @param  string  $userId  User ID
     * @return string|null Decrypted Base32 secret or null
     */
    public function getDecryptedSecret(string $userId): ?string
    {
        $encrypted = $this->getEncryptedSecret($userId);

        if ($encrypted === null) {
            return null;
        }

        try {
            return Crypt::decrypt($encrypted);
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Store recovery codes for a user.
     *
     * @param  int  $userId  User ID
     * @param  array  $codes  Plain recovery codes
     */
    public function storeRecoveryCodes(string $userId, array $codes): void
    {
        // Get the 2FA record
        $twoFa = TwoFactorAuthentication::where('user_id', $userId)->firstOrFail();

        // Delete existing recovery codes
        RecoveryCode::where('two_factor_authentication_id', $twoFa->id)->delete();

        // Store new recovery codes
        foreach ($codes as $code) {
            RecoveryCode::create([
                'two_factor_authentication_id' => $twoFa->id,
                'code_hash' => $this->hashRecoveryCode($code),
            ]);
        }
    }

    /**
     * Use a recovery code (mark as used).
     *
     * @param  int  $userId  User ID
     * @param  string  $code  Plain recovery code
     * @return bool True if code was valid and marked as used
     */
    public function useRecoveryCode(string $userId, string $code): bool
    {
        // Find an unused recovery code that matches
        $recoveryCode = RecoveryCode::whereHas('twoFactorAuthentication', function ($query) use ($userId) {
            $query->where('user_id', $userId);
        })
            ->where(function ($query) use ($code) {
                $query->where('code_hash', $this->hashRecoveryCode($code));
            })
            ->whereNull('used_at')
            ->first();

        if ($recoveryCode) {
            $recoveryCode->update(['used_at' => now()]);

            return true;
        }

        return false;
    }

    /**
     * Base32 encode (RFC 4648).
     *
     * @param  string  $data  Data to encode
     * @return string Base32 encoded string
     */
    private function base32_encode(string $data): string
    {
        $base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        $result = '';

        // Convert each byte to 8 bits
        foreach (str_split($data) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        // Split into 5-bit chunks and convert to Base32
        for ($i = 0; $i < strlen($bits); $i += 5) {
            $chunk = substr($bits, $i, 5);
            if (strlen($chunk) < 5) {
                // Pad with zeros if needed
                $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            }
            $index = bindec($chunk);
            $result .= $base32Chars[$index];
        }

        // Add padding if needed
        $padding = strlen($result) % 8;
        if ($padding > 0) {
            $result .= str_repeat('=', 8 - $padding);
        }

        return $result;
    }

    /**
     * Base32 decode (RFC 4648).
     *
     * @param  string  $data  Base32 encoded string
     * @return string|null Decoded data or null if invalid
     */
    public function base32_decode(string $data): ?string
    {
        $base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $data = strtoupper(str_replace('=', '', $data));

        // Validate characters
        if (preg_match('/[^A-Z2-7]/', $data)) {
            return null;
        }

        $bits = '';
        $result = '';

        // Convert each Base32 character to 5 bits
        foreach (str_split($data) as $char) {
            $index = strpos($base32Chars, $char);
            if ($index === false) {
                return null;
            }
            $bits .= str_pad(decbin($index), 5, '0', STR_PAD_LEFT);
        }

        // Split into 8-bit chunks and convert to bytes
        for ($i = 0; $i < strlen($bits); $i += 8) {
            $chunk = substr($bits, $i, 8);
            if (strlen($chunk) < 8) {
                break; // Incomplete byte
            }
            $result .= chr(bindec($chunk));
        }

        return $result;
    }
}
