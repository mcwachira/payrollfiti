<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Contracts\PaymentProvider;
use InvalidArgumentException;

final class PaymentProviderManager
{
    /** @var array<string, PaymentProvider> */
    private array $providers = [];

    public function register(PaymentProvider $provider): void
    {
        $this->providers[$provider->name()] = $provider;
    }

    public function get(string $provider): PaymentProvider
    {
        if (! isset($this->providers[$provider])) {
            throw new InvalidArgumentException("Unsupported payment provider [{$provider}].");
        }

        return $this->providers[$provider];
    }

    public function has(string $provider): bool
    {
        return isset($this->providers[$provider]);
    }
}
