<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Providers;

use Illuminate\Support\Facades\Log;

/**
 * Development/default SMS provider. Logs the payload instead of sending it so
 * the full pipeline (dispatch → preference → delivery → attempt → sent) can be
 * exercised without credentials. Swap the SmsProvider binding to go live.
 */
final class LogSmsProvider implements SmsProvider
{
    public function send(string $to, string $body): void
    {
        Log::info('notification.sms', ['to' => $to, 'body' => $body]);
    }
}
