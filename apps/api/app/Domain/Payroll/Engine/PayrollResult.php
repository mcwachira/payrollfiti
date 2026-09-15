<?php

namespace App\Domain\Payroll\Engine;

/**
 * Complete result of a payroll calculation.
 *
 * All monetary values are stored as decimal strings for precision.
 * The prorationFactor is also stored as a string for consistency.
 */
final readonly class PayrollResult
{
    /**
     * @param  array<StatutoryDeductionLine>  $statutoryDeductions
     * @param  array<string, string>  $voluntaryDeductions
     * @param  array<ValidationIssue>  $validation
     */
    public function __construct(
        public string $employeeId,
        public string $countryCode,
        public string $currency,
        public string $ruleVersion,
        public string $prorationFactor,
        public EarningsResult $earnings,
        public array $statutoryDeductions,
        public array $voluntaryDeductions,
        public string $totalVoluntaryDeductions,
        public TaxResult $tax,
        public string $totalDeductions,
        public string $grossPay,
        public string $netPay,
        public array $validation,
        public string $inputHash,
    ) {}

    /**
     * Get gross pay as a decimal string.
     *
     * This is provided for convenience since grossPay is already stored
     * in the earnings object.
     */
    public function getGrossPay(): string
    {
        return $this->grossPay;
    }

    /**
     * Get net pay as a decimal string.
     */
    public function getNetPay(): string
    {
        return $this->netPay;
    }

    /**
     * Create from legacy float-based values.
     *
     * @param  array<StatutoryDeductionLine>  $statutoryDeductions
     * @param  array<string, float|string>  $voluntaryDeductions
     * @param  array<ValidationIssue>  $validation
     */
    public static function fromLegacy(
        string $employeeId,
        string $countryCode,
        string $currency,
        string $ruleVersion,
        float|string $prorationFactor,
        EarningsResult $earnings,
        array $statutoryDeductions,
        array $voluntaryDeductions,
        float|string $totalVoluntaryDeductions,
        TaxResult $tax,
        float|string $totalDeductions,
        float|string $grossPay,
        float|string $netPay,
        array $validation,
        string $inputHash,
    ): self {
        return new self(
            employeeId: $employeeId,
            countryCode: $countryCode,
            currency: $currency,
            ruleVersion: $ruleVersion,
            prorationFactor: Money::toDecimal($prorationFactor),
            earnings: $earnings,
            statutoryDeductions: $statutoryDeductions,
            voluntaryDeductions: array_map(fn ($k, $v) => Money::toDecimal($v), array_keys($voluntaryDeductions), $voluntaryDeductions),
            totalVoluntaryDeductions: Money::toDecimal($totalVoluntaryDeductions),
            tax: $tax,
            totalDeductions: Money::toDecimal($totalDeductions),
            grossPay: Money::toDecimal($grossPay),
            netPay: Money::toDecimal($netPay),
            validation: $validation,
            inputHash: $inputHash,
        );
    }
}
