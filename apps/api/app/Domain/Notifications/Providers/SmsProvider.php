<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Providers;

/**
 * Outbound SMS provider boundary. PayrollFiti ships a no-op logger
 * implementation; a real provider (Twilio, Africa's Talking, ...) only needs to
 * implement this method and swap the binding in NotificationServiceProvider.
 */
interface SmsProvider
{
    /**
     * @throws \Throwable when the transport cannot accept the message; the
     *                    delivery job records last_error and retries.
     */
    public function send(string $to, string $body): void;
}
