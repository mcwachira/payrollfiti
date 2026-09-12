<?php

namespace App\Domain\Payments\Contracts;

final readonly class WebhookEvent
{
    public function __construct(
        public string $providerEventId,
        public string $eventType,
        public ?string $reference,
        public PaymentStatus $status,
        public ?string $providerTransactionId,
        public ?string $rawPayload,
    ) {}
}
