<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Channels;

use App\Domain\Notifications\Contracts\NotificationChannel;
use App\Domain\Notifications\Providers\PushProvider;
use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Push channel — fans out to every Web Push subscription registered by the
 * recipient (one per browser, all endpoints are attempted). A delivery is only
 * marked sent when at least one endpoint accepted the payload; throw if none
 * does, so the job layer can retry.
 */
final class PushChannel implements NotificationChannel
{
    public function __construct(
        private readonly PushProvider $provider,
    ) {}

    public function key(): string
    {
        return 'push';
    }

    public function send(Notification $notification, NotificationDelivery $delivery, User $recipient): void
    {
        $subscriptions = PushSubscription::query()
            ->where('user_id', $recipient->id)
            ->get();

        if ($subscriptions->isEmpty()) {
            throw new \RuntimeException("Recipient [{$recipient->id}] has no push subscriptions.");
        }

        foreach ($subscriptions as $subscription) {
            $this->provider->send(
                $subscription,
                $notification->title,
                $notification->body,
                is_string($notification->data['url'] ?? null) ? $notification->data['url'] : null,
            );

            $subscription->forceFill(['last_used_at' => Carbon::now()])->save();
        }

        $delivery->markSent();
    }
}
