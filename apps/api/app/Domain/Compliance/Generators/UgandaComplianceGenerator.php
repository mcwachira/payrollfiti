<?php

namespace App\Domain\Compliance\Generators;

final class UgandaComplianceGenerator extends AbstractCountryComplianceGenerator
{
    public function countryCode(): string
    {
        return 'UG';
    }

    public function reportCode(): string
    {
        return 'UG-PAYE';
    }

    public function version(): string
    {
        return 'UG-2025.1';
    }
}
