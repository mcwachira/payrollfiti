<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Providers;

use App\Models\PushSubscription;

/**
 * Web Push transport boundary. The real implementation would sign a payload
 * with the configured VAPID keys (config/services.php vapid block) and POST it
 * to the subscription endpoint. Removing stale endpoints is the provider's job;
 * the delivery job does our bookkeeping.
 */
interface PushProvider
{
    public function send(PushSubscription $subscription, string $title, string $body, ?string $url = null): void;
}
