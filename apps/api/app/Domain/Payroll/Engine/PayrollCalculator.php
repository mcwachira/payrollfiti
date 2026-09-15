<?php

namespace App\Domain\Payroll\Engine;

/**
 * Core payroll calculation engine.
 *
 * All monetary calculations use string-based decimal arithmetic
 * via the Money helper class to ensure financial precision.
 *
 * NEVER use PHP float arithmetic for monetary calculations.
 */
final class PayrollCalculator
{
    public function calculate(PayrollInput $input, CountryRuleSet $ruleSet): PayrollResult
    {
        $validation = $ruleSet->validate($input);
        $prorationFactor = Proration::factor($input);

        // Calculate earnings (all values are strings)
        $fullEarnings = $ruleSet->calculateEarnings($input);
        $earnings = $fullEarnings->prorate($prorationFactor);

        // Calculate statutory deductions
        $statutoryDeductions = $ruleSet->calculateStatutoryDeductions($earnings->grossPay, $earnings);

        // Calculate tax
        $tax = $ruleSet->calculateTax($earnings->grossPay, $statutoryDeductions);

        // Sum voluntary deductions
        $totalVoluntary = Money::sum(array_values($input->voluntaryDeductions));

        // Sum employee portion of statutory deductions
        $totalStatutoryEmployee = Money::sum(
            array_map(fn (StatutoryDeductionLine $line) => $line->employeeAmount, $statutoryDeductions)
        );

        // Total deductions = statutory (employee) + tax + voluntary
        $totalDeductions = Money::round2(
            Money::add($totalStatutoryEmployee, $tax->netTax)
        );
        $totalDeductions = Money::round2(
            Money::add($totalDeductions, $totalVoluntary)
        );

        // Net pay = gross pay - total deductions
        $netPay = Money::round2(
            Money::sub($earnings->grossPay, $totalDeductions)
        );

        return new PayrollResult(
            employeeId: $input->employeeId,
            countryCode: $ruleSet->countryCode(),
            currency: $input->currency,
            ruleVersion: $ruleSet->version(),
            prorationFactor: Money::toDecimal($prorationFactor),
            earnings: $earnings,
            statutoryDeductions: $statutoryDeductions,
            voluntaryDeductions: $input->voluntaryDeductions,
            totalVoluntaryDeductions: $totalVoluntary,
            tax: $tax,
            totalDeductions: $totalDeductions,
            grossPay: $earnings->grossPay,
            netPay: $netPay,
            validation: $validation,
            inputHash: $this->computeInputHash($input, $ruleSet->version()),
        );
    }

    public function computeInputHash(PayrollInput $input, string $ruleVersion): string
    {
        // Use stable JSON for consistent hashing
        // All monetary values are already strings, so hashing is consistent
        return hash('sha256', Money::stableJson(['input' => $input, 'ruleVersion' => $ruleVersion]));
    }
}
