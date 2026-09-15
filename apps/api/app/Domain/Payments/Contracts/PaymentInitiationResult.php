<?php

namespace App\Domain\Payments\Contracts;

final readonly class PaymentInitiationResult
{
    public function __construct(
        public bool $success,
        public ?string $providerReference,
        public ?string $authorizationUrl,
        public ?string $providerResponse,
        public ?string $error,
    ) {}
}
