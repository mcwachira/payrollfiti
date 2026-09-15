<?php

namespace App\Domain\Payroll\Engine\Rules\Kenya;

use App\Domain\Payroll\Engine\CountryRuleSet;
use App\Domain\Payroll\Engine\EarningsResult;
use App\Domain\Payroll\Engine\Money;
use App\Domain\Payroll\Engine\PayrollInput;
use App\Domain\Payroll\Engine\StatutoryDeductionLine;
use App\Domain\Payroll\Engine\TaxResult;
use App\Domain\Payroll\Engine\ValidationIssue;
use DateTimeImmutable;

final class Kenya2025RuleSet implements CountryRuleSet
{
    public function countryCode(): string
    {
        return 'KE';
    }

    public function version(): string
    {
        return 'KE-2025';
    }

    public function effectiveFrom(): DateTimeImmutable
    {
        return new DateTimeImmutable('2024-10-01');
    }

    public function currency(): string
    {
        return 'KES';
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
            new StatutoryDeductionLine('NSSF', 'National Social Security Fund', Nssf::calculate($grossPay), '0'),
            new StatutoryDeductionLine('SHIF', 'Social Health Insurance Fund', Shif::calculate($grossPay), '0'),
            new StatutoryDeductionLine('HOUSING_LEVY', 'Housing Levy', HousingLevy::calculate($grossPay), '0'),
        ];
    }

    public function calculateTax(string $grossPay, array $statutoryDeductions): TaxResult
    {
        $totalEmployeeStatutory = Money::sum(
            array_map(fn ($item) => $item->employeeAmount, $statutoryDeductions)
        );
        $taxable = Money::sub($grossPay, $totalEmployeeStatutory);

        if (Money::cmp($taxable, '0') < 0) {
            $taxable = '0';
        }

        $grossTax = Money::round2(Money::mul($taxable, '0.1'));

        return new TaxResult(grossTax: $grossTax, netTax: $grossTax);
    }

    public function validate(PayrollInput $input): array
    {
        $issues = [];

        if (Money::cmp($input->basicSalary, '0') < 0) {
            $issues[] = new ValidationIssue('basicSalary', 'Basic salary must not be negative.');
        }

        if ($input->periodEnd < $input->periodStart) {
            $issues[] = new ValidationIssue('periodEnd', 'Period end must be on or after period start.');
        }

        return $issues;
    }
}
