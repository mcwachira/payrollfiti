<?php

namespace App\Domain\Payroll\Engine\Rules\Nigeria;

use App\Domain\Payroll\Engine\CountryRuleSet;
use App\Domain\Payroll\Engine\EarningsResult;
use App\Domain\Payroll\Engine\Money;
use App\Domain\Payroll\Engine\PayrollInput;
use App\Domain\Payroll\Engine\StatutoryDeductionLine;
use App\Domain\Payroll\Engine\TaxResult;
use App\Domain\Payroll\Engine\ValidationIssue;
use DateTimeImmutable;

final class Nigeria2024RuleSet implements CountryRuleSet
{
    public function countryCode(): string
    {
        return 'NG';
    }

    public function version(): string
    {
        return 'NG-2024';
    }

    public function effectiveFrom(): DateTimeImmutable
    {
        return new DateTimeImmutable('2024-01-01');
    }

    public function currency(): string
    {
        return 'NGN';
    }

    public function calculateEarnings(PayrollInput $input): EarningsResult
    {
        $allowancesTotal = Money::sum(array_values($input->allowances));
        $gross = Money::round2(
            Money::add(
                Money::add(
                    Money::add(
                        Money::add($input->basicSalary, $allowancesTotal),
                        $input->overtimeAmount
                    ),
                    $input->commissionAmount
                ),
                $input->bonusAmount
            )
        );

        return new EarningsResult(
            basicSalary: Money::round2($input->basicSalary),
            allowancesTotal: Money::round2($allowancesTotal),
            grossPay: $gross,
        );
    }

    public function calculateStatutoryDeductions(string $grossPay, EarningsResult $earnings): array
    {
        return [
            new StatutoryDeductionLine('PENSION', 'Pension', '0', '0'),
            new StatutoryDeductionLine('NHF', 'National Housing Fund', '0', '0'),
        ];
    }

    public function calculateTax(string $grossPay, array $statutoryDeductions): TaxResult
    {
        $tax = Money::round2(Money::mul($grossPay, '0.07'));

        return new TaxResult(grossTax: $tax, netTax: $tax);
    }

    public function validate(PayrollInput $input): array
    {
        if (Money::cmp($input->basicSalary, '0') < 0) {
            return [new ValidationIssue('basicSalary', 'Basic salary must not be negative.')];
        }

        if ($input->periodEnd < $input->periodStart) {
            return [new ValidationIssue('periodEnd', 'Period end must be on or after period start.')];
        }

        return [];
    }
}
