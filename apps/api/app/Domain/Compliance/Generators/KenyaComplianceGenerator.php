<?php

namespace App\Domain\Compliance\Generators;

final class KenyaComplianceGenerator extends AbstractCountryComplianceGenerator
{
    public function countryCode(): string
    {
        return 'KE';
    }

    public function reportCode(): string
    {
        return 'KE-P9';
    }

    public function version(): string
    {
        return 'KE-2025.1';
    }
}
