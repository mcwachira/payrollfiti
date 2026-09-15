<?php

namespace App\Domain\Payroll\Engine;

use DateTimeImmutable;

/**
 * Input data for payroll calculation.
 *
 * All monetary values MUST be passed as strings to ensure decimal precision.
 * NEVER use PHP float for monetary values in this class.
 */
final readonly class PayrollInput
{
    /**
     * @param  array<string, string>  $allowances  Allowance amounts as decimal strings
     * @param  array<string, string>  $voluntaryDeductions  Voluntary deduction amounts as decimal strings
     */
    public function __construct(
        public string $employeeId,
        public string $countryCode,
        public string $currency,
        public string $basicSalary,
        public array $allowances,
        public string $overtimeAmount,
        public string $commissionAmount,
        public string $bonusAmount,
        public array $voluntaryDeductions,
        public DateTimeImmutable $periodStart,
        public DateTimeImmutable $periodEnd,
        public ?DateTimeImmutable $employmentStartDate = null,
        public ?DateTimeImmutable $employmentEndDate = null,
    ) {}

    /**
     * Create a PayrollInput from legacy float-based values.
     *
     * This factory method is provided for transitioning from float-based code.
     * In new code, always pass strings directly to the constructor.
     *
     * @param  array<string, float|string>  $allowances
     * @param  array<string, float|string>  $voluntaryDeductions
     */
    public static function fromLegacy(
        string $employeeId,
        string $countryCode,
        string $currency,
        float|string $basicSalary,
        array $allowances,
        float|string $overtimeAmount,
        float|string $commissionAmount,
        float|string $bonusAmount,
        array $voluntaryDeductions,
        DateTimeImmutable $periodStart,
        DateTimeImmutable $periodEnd,
        ?DateTimeImmutable $employmentStartDate = null,
        ?DateTimeImmutable $employmentEndDate = null,
    ): self {
        return new self(
            employeeId: $employeeId,
            countryCode: $countryCode,
            currency: $currency,
            basicSalary: Money::toDecimal($basicSalary),
            allowances: array_map([Money::class, 'toDecimal'], $allowances),
            overtimeAmount: Money::toDecimal($overtimeAmount),
            commissionAmount: Money::toDecimal($commissionAmount),
            bonusAmount: Money::toDecimal($bonusAmount),
            voluntaryDeductions: array_map([Money::class, 'toDecimal'], $voluntaryDeductions),
            periodStart: $periodStart,
            periodEnd: $periodEnd,
            employmentStartDate: $employmentStartDate,
            employmentEndDate: $employmentEndDate,
        );
    }
}
