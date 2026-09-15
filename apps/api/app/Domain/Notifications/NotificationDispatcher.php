<?php

declare(strict_types=1);

namespace App\Domain\Notifications;

use App\Jobs\SendNotificationDelivery;
use App\Models\Notification;
use App\Models\NotificationPreference;
use Illuminate\Support\Facades\Schema;

/**
 * Single entry point for creating notifications (Part 14).
 *
 * Responsibility boundary (events → listeners → dispatcher):
 *  - Listeners extract the *candidate* recipients + event data and call
 *    notify(); they never touch notification tables directly.
 *  - The dispatcher: resolves/creates per-user preferences, renders templates,
 *    dedupes via entity key, persists the notification row, creates one
 *    NotificationDelivery per enabled channel and hands the non-in-app
 *    channels to the appNotifications queue.
 *
 * Idempotency: when the event data carries `entity_type` + `entity_id` a sha256
 * hash of (tenant|user|event|entity) is stored in dedupe_hash; a retried
 * listener finds the row and stops. The DB unique index on
 * (tenant_id, dedupe_hash) is the backstop against races. Events without an
 * entity are never deduped.
 *
 * Tenant safety: rows are only ever written with the explicit tenantId passed
 * in and read with withoutTenantScope(). Delivery jobs run under
 * SendNotificationDelivery (TenantAwareJob), so workers are tenant-isolated.
 */
final class NotificationDispatcher
{
    public function __construct(
        private readonly ChannelRegistry $channels,
        private readonly TemplateRenderer $renderer,
    ) {}

    /**
     * @param  string|string[]  $userIds  Candidate recipients. Each recipient is
     *                                    gated by their own preferences.
     * @return Notification[] rows actually created (empty when a recipient has
     *                        no enabled channel or the event was deduped)
     */
    public function notify(string $tenantId, string|array $userIds, string $eventType, array $data = []): array
    {
        if ($this->notificationSchemaMissing()) {
            return [];
        }

        $created = [];

        foreach ((array) $userIds as $userId) {
            $preference = $this->preferenceFor($tenantId, (string) $userId, $eventType);

            if ($preference === null || $preference->enabledChannels() === []) {
                continue;
            }

            $dedupeHash = $this->dedupeHash($tenantId, (string) $userId, $eventType, $data);

            if ($dedupeHash !== null && $this->alreadyDelivered($tenantId, $dedupeHash)) {
                continue;
            }

            $rendered = $this->renderer->render($tenantId, $eventType, 'in_app', $data);

            $notification = Notification::withoutTenantScope()->create([
                'tenant_id' => $tenantId,
                'user_id' => (string) $userId,
                'template_id' => $rendered['template']?->id,
                'event_type' => $eventType,
                'dedupe_hash' => $dedupeHash,
                'title' => $rendered['subject'] ?? NotificationTypes::title($eventType) ?? $eventType,
                'body' => $rendered['body'],
                'data' => $data,
                'read_at' => null,
            ]);

            foreach ($preference->enabledChannels() as $channelKey) {
                $this->createDelivery($notification, $tenantId, $channelKey);
            }

            $created[] = $notification;
        }

        return $created;
    }

    private function createDelivery(Notification $notification, string $tenantId, string $channelKey): void
    {
        if (! $this->channels->has($channelKey)) {
            return;
        }

        $delivery = $notification->deliveries()->withoutGlobalScopes()->create([
            'tenant_id' => $tenantId,
            'channel' => $channelKey,
            'status' => 'queued',
            'attempts' => 0,
        ]);

        if ($channelKey === 'in_app') {
            $delivery->markSent();

            return;
        }

        $delivery->status = 'queued';
        $delivery->save();

        SendNotificationDelivery::dispatch($delivery->id, $tenantId)->onQueue(config('notifications.queue', 'notifications'));
    }

    private function preferenceFor(string $tenantId, string $userId, string $eventType): ?NotificationPreference
    {
        $preference = NotificationPreference::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->where('event_type', $eventType)
            ->first();

        if ($preference !== null) {
            return $preference;
        }

        $defaults = NotificationTypes::defaults($eventType);

        return NotificationPreference::withoutTenantScope()->create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'event_type' => $eventType,
            'in_app' => $defaults['in_app'],
            'email' => $defaults['email'],
            'sms' => $defaults['sms'],
            'push' => $defaults['push'],
        ]);
    }

    private function dedupeHash(string $tenantId, string $userId, string $eventType, array $data): ?string
    {
        $entityType = $data['entity_type'] ?? null;
        $entityId = $data['entity_id'] ?? null;

        if (! is_string($entityType) || $entityType === '' || ! is_scalar($entityId) || $entityId === '') {
            return null;
        }

        return hash('sha256', implode('|', [$tenantId, $userId, $eventType, $entityType, (string) $entityId]));
    }

    private function alreadyDelivered(string $tenantId, string $dedupeHash): bool
    {
        return Notification::withoutTenantScope()
            ->where('tenant_id', $tenantId)
            ->where('dedupe_hash', $dedupeHash)
            ->exists();
    }

    private function notificationSchemaMissing(): bool
    {
        // Every table the dispatcher may touch: partial schemas (e.g. domain
        // tests that don't install the notification tables) must be skipped
        // wholesale instead of failing mid-flight and aborting callers.
        return ! Schema::hasTable('notifications')
            || ! Schema::hasTable('notification_preferences')
            || ! Schema::hasTable('notification_deliveries')
            || ! Schema::hasTable('notification_templates');
    }
}
