<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Providers;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;

/**
 * Development/default push provider. Logs the payload; a production
 * implementation (e.g. minishlink/web-push) replaces this binding.
 */
final class LogPushProvider implements PushProvider
{
    public function send(PushSubscription $subscription, string $title, string $body, ?string $url = null): void
    {
        Log::info('notification.push', [
            'subscription_id' => $subscription->id,
            'endpoint' => $subscription->endpoint,
            'title' => $title,
            'body' => $body,
            'url' => $url,
        ]);
    }
}
