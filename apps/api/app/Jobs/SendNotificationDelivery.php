<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Notifications\ChannelRegistry;
use App\Models\NotificationDelivery;
use Throwable;

/**
 * Per-channel delivery worker for the `notifications` queue.
 *
 * Lifecycle per attempt:
 *   1. load the delivery + its notification + recipient (all without shape
 *      leakage — rows are tenant-checked against $this->tenantId);
 *   2. skip if already sent (idempotent re-delivery of a terminal delivery);
 *   3. increment attempts, resolve the channel and hand the payload off;
 *   4. channel markSent()s on success; on failure last_error/failed_at are
 *      persisted and the exception is rethrown so Laravel retries with
 *      backoff. failed() dead-letters the delivery row as `failed`.
 */
class SendNotificationDelivery extends TenantAwareJob
{
    /**
     * The delivery id this job owns.
     */
    public string $deliveryId;

    public $queue = 'notifications';

    public int $tries = 3;

    public int $maxExceptions = 3;

    public int $timeout = 60;

    public function __construct(string $deliveryId, string $tenantId)
    {
        $this->deliveryId = $deliveryId;
        $this->tenantId = $tenantId;
    }

    protected function execute(): void
    {
        $delivery = NotificationDelivery::withoutTenantScope()
            ->with(['notification', 'notification.user'])
            ->find($this->deliveryId);

        if ($delivery === null || $delivery->tenant_id !== $this->tenantId) {
            return;
        }

        if (in_array($delivery->status, ['sent', 'delivered'], true)) {
            return;
        }

        $notification = $delivery->notification;

        if ($notification === null) {
            $delivery->markFailed('Notification row no longer exists.');

            return;
        }

        $recipient = $notification->user;

        if ($recipient === null || $recipient->tenant_id !== $this->tenantId) {
            $delivery->markFailed('Notification recipient is no longer available in this tenant.');

            return;
        }

        $registry = app(ChannelRegistry::class);

        if (! $registry->has($delivery->channel)) {
            $delivery->markFailed("Channel [{$delivery->channel}] is not registered.");

            return;
        }

        $delivery->incrementAttempts();

        try {
            $registry->get($delivery->channel)->send($notification, $delivery, $recipient);
        } catch (Throwable $e) {
            $delivery->forceFill([
                'failed_at' => now(),
                'last_error' => mb_substr($e->getMessage(), 0, 1000),
            ])->save();

            throw $e;
        }
    }

    public function failed(?Throwable $e = null): void
    {
        $delivery = NotificationDelivery::withoutTenantScope()->find($this->deliveryId);

        if ($delivery === null) {
            return;
        }

        $delivery->markFailed(
            $e !== null ? mb_substr($e->getMessage(), 0, 1000) : 'Delivery failed after exhausting retries.',
        );
    }
}
