<?php

declare(strict_types=1);

namespace App\Domain\Payments\Events;

/**
 * Emitted by the transactional outbox relay when a payment transaction settles
 * successfully (Part 13 §13.5 / §13.7).
 *
 * Carries the invoice + provider context in `payload` (written at settlement
 * time), which listeners forward to subscribed webhook endpoints.
 */
final class PaymentSettled
{
    public function __construct(
        public readonly string $tenantId,
        public readonly string $paymentTransactionId,
        public readonly array $payload = [],
    ) {}

    public function invoiceId(): ?string
    {
        return $this->payload['invoice_id'] ?? null;
    }

    public function provider(): ?string
    {
        return $this->payload['provider'] ?? null;
    }
}
