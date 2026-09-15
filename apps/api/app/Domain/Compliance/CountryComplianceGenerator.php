<?php

namespace App\Domain\Compliance;

use App\Models\PayrollRun;

interface CountryComplianceGenerator
{
    public function countryCode(): string;

    public function reportCode(): string;

    public function version(): string;

    public function generate(PayrollRun $payrollRun): array;
}
