<?php

namespace App\Domain\Compliance\Generators;

final class SouthAfricaComplianceGenerator extends AbstractCountryComplianceGenerator
{
    public function countryCode(): string
    {
        return 'ZA';
    }

    public function reportCode(): string
    {
        return 'ZA-PAYE';
    }

    public function version(): string
    {
        return 'ZA-2025.1';
    }
}
