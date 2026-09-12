<?php

namespace App\Domain\Payroll\Engine;

use DateTimeImmutable;

interface CountryRuleSet
{
    public function countryCode(): string;

    public function version(): string;

    public function effectiveFrom(): DateTimeImmutable;

    public function currency(): string;

    public function calculateEarnings(PayrollInput $input): EarningsResult;

    /** @return StatutoryDeductionLine[] */
    public function calculateStatutoryDeductions(string $grossPay, EarningsResult $earnings): array;

    public function calculateTax(string $grossPay, array $statutoryDeductions): TaxResult;

    /** @return ValidationIssue[] */
    public function validate(PayrollInput $input): array;
}
