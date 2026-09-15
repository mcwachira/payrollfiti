<?php

declare(strict_types=1);

namespace App\Domain\Accounting;

use App\Domain\Accounting\Contracts\AccountingProvider;
use InvalidArgumentException;

final class AccountingProviderManager
{
    /** @var array<string, AccountingProvider> */
    private array $providers = [];

    public function register(AccountingProvider $provider): void
    {
        $this->providers[$provider->name()] = $provider;
    }

    public function get(string $provider): AccountingProvider
    {
        if (! isset($this->providers[$provider])) {
            throw new InvalidArgumentException("Unsupported accounting provider [{$provider}].");
        }

        return $this->providers[$provider];
    }

    public function has(string $provider): bool
    {
        return isset($this->providers[$provider]);
    }
}
