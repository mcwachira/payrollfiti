<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\WebhookDeliveryLog;
use App\Models\WebhookEndpoint;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Deliver one webhook event to one tenant endpoint (Part 13 §13.5).
 *
 * Finally consistent: records the delivery attempt in webhook_delivery_logs
 * (pending -> delivered / failed), signs the raw body with HMAC-SHA-256 using
 * the endpoint's encrypted secret when available, and retries transient HTTP
 * failures with up to 6h of exponential backoff before dead-lettering into
 * failed_jobs.
 *
 * WithoutOverlapping (runtime-keyed by endpoint:event:event) guarantees the
 * same delivery is never in flight twice; the delivery log's per-event
 * idempotent write guarantees at-most-once bookkeeping regardless.
 */
final class DeliverWebhook extends TenantAwareJob implements ShouldBeUnique
{
    public string $endpointId;

    public string $eventType;

    public string $eventId;

    public array $payload = [];

    public function __construct(string $tenantId, string $endpointId, string $eventType, string $eventId, array $payload)
    {
        $this->tenantId = $tenantId;
        $this->endpointId = $endpointId;
        $this->eventType = $eventType;
        $this->eventId = $eventId;
        $this->payload = $payload;
        $this->tries = 6;
        $this->timeout = 60;
        $this->onQueue('webhooks');
    }

    public function uniqueId(): string
    {
        return $this->endpointId.':'.$this->eventType.':'.$this->eventId;
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function middleware(): array
    {
        return [new WithoutOverlapping($this->uniqueId(), 3600)];
    }

    public function backoff(): array
    {
        // Up to 6h exponential backoff for provider/network transients.
        return [5, 30, 120, 600, 3600, 21600];
    }

    protected function execute(): void
    {
        $endpoint = WebhookEndpoint::withoutTenantScope()
            ->where('tenant_id', $this->tenantId)
            ->find($this->endpointId);

        if ($endpoint === null || $endpoint->status !== 'active') {
            // Endpoint deleted/disabled before delivery — nothing to send.
            WebhookDeliveryLog::withoutTenantScope()
                ->where('webhook_endpoint_id', $this->endpointId)
                ->where('event_type', $this->eventType)
                ->where('event_id', $this->eventId)
                ->update(['status' => 'skipped']);

            return;
        }

        $body = json_encode($this->payload, JSON_THROW_ON_ERROR);

        $signature = null;
        if ($endpoint->secret_ciphertext !== null) {
            $signature = hash_hmac('sha256', $body, Crypt::decryptString($endpoint->secret_ciphertext));
        }

        $headers = [
            'Content-Type' => 'application/json',
            'User-Agent' => 'PayrollFiti-Webhooks/1.0',
            'X-Event-Type' => $this->eventType,
            'X-Event-Id' => $this->eventId,
        ];

        if ($signature !== null) {
            $headers['X-Webhook-Signature'] = $signature;
        }

        $delivery = WebhookDeliveryLog::withoutTenantScope()->firstOrCreate(
            [
                'tenant_id' => $this->tenantId,
                'webhook_endpoint_id' => $endpoint->id,
                'event_type' => $this->eventType,
                'event_id' => $this->eventId,
            ],
            ['status' => 'pending', 'attempts' => 0],
        );

        $started = hrtime(true);

        try {
            $response = Http::connectTimeout(5)
                ->timeout(20)
                ->withHeaders($headers)
                ->post($endpoint->url, $this->payload);

            $durationMs = (int) ((hrtime(true) - $started) / 1_000_000);

            if ($response->serverError() || $response->clientError()) {
                $delivery->update([
                    'attempts' => $delivery->attempts + 1,
                    'response_status' => $response->status(),
                    'response_time_ms' => $durationMs,
                    'response_body' => substr((string) $response->body(), 0, 4000),
                    'error' => 'Webhook endpoint responded '.$response->status(),
                    'next_attempt_at' => now()->addSeconds($this->backoff()[$delivery->attempts] ?? 3600),
                ]);

                throw new \RuntimeException('Webhook delivery failed with HTTP '.$response->status());
            }

            $delivery->update([
                'status' => 'delivered',
                'attempts' => $delivery->attempts + 1,
                'response_status' => $response->status(),
                'response_time_ms' => $durationMs,
                'response_body' => substr((string) $response->body(), 0, 4000),
                'error' => null,
                'delivered_at' => now(),
            ]);

            WebhookEndpoint::withoutTenantScope()
                ->whereKey($endpoint->id)
                ->update(['last_delivered_at' => now()]);
        } catch (Throwable $e) {
            $durationMs = (int) ((hrtime(true) - $started) / 1_000_000);
            $delivery->update([
                'attempts' => $delivery->attempts + 1,
                'response_time_ms' => $durationMs,
                'error' => substr($e->getMessage(), 0, 2000),
            ]);

            throw $e;
        }
    }

    public function failed(Throwable $exception): void
    {
        WebhookDeliveryLog::withoutTenantScope()
            ->where('webhook_endpoint_id', $this->endpointId)
            ->where('event_type', $this->eventType)
            ->where('event_id', $this->eventId)
            ->update(['status' => 'failed']);

        Log::error('deliver_webhook.failed', [
            'tenant_id' => $this->tenantId,
            'endpoint_id' => $this->endpointId,
            'event_type' => $this->eventType,
            'event_id' => $this->eventId,
            'error' => $exception->getMessage(),
        ]);
    }
}
