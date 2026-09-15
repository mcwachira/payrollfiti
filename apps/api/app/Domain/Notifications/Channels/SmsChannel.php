<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Channels;

use App\Domain\Notifications\Contracts\NotificationChannel;
use App\Domain\Notifications\Providers\SmsProvider;
use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\User;

/**
 * SMS channel. Requires a destination phone number, which is not stored on the
 * user record — it can be supplied per event via `data.phone` or skipped
 * (throws) when no phone is available; the job layer records the miss and
 * retries/fails the delivery instead of silently dropping the user's opt-in.
 */
final class SmsChannel implements NotificationChannel
{
    public function __construct(
        private readonly SmsProvider $provider,
    ) {}

    public function key(): string
    {
        return 'sms';
    }

    public function send(Notification $notification, NotificationDelivery $delivery, User $recipient): void
    {
        $phone = $notification->data['phone'] ?? null;

        if (! is_string($phone) || $phone === '') {
            throw new \RuntimeException("Recipient [{$recipient->id}] has no phone number; sms delivery skipped.");
        }

        $this->provider->send($phone, $notification->body);

        $delivery->markSent();
    }
}
