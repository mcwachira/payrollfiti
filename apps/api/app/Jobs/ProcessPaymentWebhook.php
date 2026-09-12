<?php

namespace App\Jobs;

use App\Domain\Payments\Contracts\PaymentStatus;
use App\Models\Invoice;
use App\Models\OutboxEvent;
use App\Models\PaymentProviderEvent;
use App\Models\PaymentTransaction;
use App\Support\TenantContext;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class ProcessPaymentWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public string $webhookEventId;

    public int $tries = 6;

    private const RETRY_DELAY_SECONDS = 5;

    public function __construct(string $webhookEventId)
    {
        $this->webhookEventId = $webhookEventId;
        $this->onQueue('webhooks');
    }

    public function backoff(): array
    {
        return [self::RETRY_DELAY_SECONDS, self::RETRY_DELAY_SECONDS * 2, self::RETRY_DELAY_SECONDS * 3];
    }

    public function handle(): void
    {
        TenantContext::clear();

        $event = PaymentProviderEvent::withoutTenantScope()->whereKey($this->webhookEventId)->first();

        if ($event === null || $event->status === 'processed') {
            return;
        }

        $payload = is_array($event->payload)
            ? $event->payload
            : json_decode((string) $event->payload, true) ?? [];

        $reference = $this->referenceFromPayload($payload);

        if ($reference === null) {
            $this->markSkipped($event);

            return;
        }

        $tenantId = $this->tenantFromReference($reference);

        if ($tenantId === null) {
            Log::warning('process_payment_webhook.unknown_tenant_in_reference', [
                'webhook_event_id' => $event->id,
                'reference' => $reference,
            ]);

            $this->markSkipped($event);

            return;
        }

        TenantContext::set($tenantId);

        try {
            $transaction = PaymentTransaction::withoutTenantScope()
                ->where('idempotency_key', $reference)
                ->first();

            if ($transaction === null) {
                Log::warning('process_payment_webhook.unmatched_event', [
                    'webhook_event_id' => $event->id,
                    'reference' => $reference,
                ]);

                $this->markSkipped($event);

                return;
            }

            $newStatus = $this->statusFromPayload($payload);

            // Payment settlement is a money event: cheap at-least-once
            // post-commit dispatch is not enough. The invoice→paid state and
            // its payment.settled outbox marker commit in ONE transaction
            // (Part 13 §13.7), so the outbox relay can never deliver a
            // settlement event for an invoice that was never actually paid.
            DB::transaction(function () use ($transaction, $event, $newStatus, $payload): void {
                $transaction->transitionTo(
                    $newStatus,
                    $this->providerTransactionIdFromPayload($payload),
                    $payload,
                );

                if ($newStatus === 'succeeded' && $transaction->invoice_id !== null) {
                    Invoice::withoutTenantScope()
                        ->whereKey($transaction->invoice_id)
                        ->update([
                            'status' => 'paid',
                            'paid_at' => now(),
                        ]);

                    OutboxEvent::create([
                        'tenant_id' => $transaction->tenant_id,
                        'event_type' => 'payment.settled',
                        'aggregate_type' => 'payment_transaction',
                        'aggregate_id' => $transaction->id,
                        'payload' => [
                            'invoice_id' => $transaction->invoice_id,
                            'provider' => $event->provider,
                            'transaction_id' => $transaction->id,
                            'amount' => $transaction->amount,
                        ],
                        'available_at' => now(),
                    ]);
                }

                PaymentProviderEvent::withoutTenantScope()
                    ->whereKey($event->id)
                    ->update([
                        'status' => 'processed',
                        'processed_at' => now(),
                    ]);
            });
        } finally {
            TenantContext::clear();
        }
    }

    private function referenceFromPayload(array $payload): ?string
    {
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        return $data['reference']
            ?? $data['metadata']['reference']
            ?? $data['account_reference']
            ?? null;
    }

    private function providerTransactionIdFromPayload(array $payload): ?string
    {
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        return isset($data['id']) ? (string) $data['id'] : null;
    }

    private function statusFromPayload(array $payload): string
    {
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        return match ($data['status'] ?? null) {
            'success' => PaymentStatus::Succeeded->value,
            'failed', 'abandoned', 'expired' => PaymentStatus::Failed->value,
            default => PaymentStatus::Processing->value,
        };
    }

    private function tenantFromReference(string $reference): ?string
    {
        $parts = explode('_', $reference);

        if (count($parts) < 3) {
            return null;
        }

        $tenantToken = $parts[1];

        if (strlen($tenantToken) !== 32) {
            return null;
        }

        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($tenantToken, 0, 8),
            substr($tenantToken, 8, 4),
            substr($tenantToken, 12, 4),
            substr($tenantToken, 16, 4),
            substr($tenantToken, 20, 12),
        );
    }

    private function markSkipped(PaymentProviderEvent $event): void
    {
        PaymentProviderEvent::withoutTenantScope()
            ->whereKey($event->id)
            ->update(['status' => 'skipped']);
    }
}
