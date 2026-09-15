<?php

namespace App\Domain\Compliance\Generators;

final class NigeriaComplianceGenerator extends AbstractCountryComplianceGenerator
{
    public function countryCode(): string
    {
        return 'NG';
    }

    public function reportCode(): string
    {
        return 'NG-PAYE';
    }

    public function version(): string
    {
        return 'NG-2025.1';
    }
}
