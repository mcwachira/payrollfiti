<?php

namespace App\Domain\Payments\Contracts;

final readonly class PaymentRequest
{
    public function __construct(
        public string $amount,
        public string $currency,
        public string $reference,
        public string $description,
        public ?string $callbackUrl = null,
        public ?string $phoneNumber = null,
        public ?string $email = null,
    ) {}
}
