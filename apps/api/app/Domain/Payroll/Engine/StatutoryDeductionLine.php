<?php

namespace App\Domain\Payroll\Engine;

/**
 * A single line item for statutory deductions.
 *
 * All monetary values are stored as decimal strings for precision.
 */
final readonly class StatutoryDeductionLine
{
    public function __construct(
        public string $code,
        public string $label,
        public string $employeeAmount,
        public string $employerAmount,
    ) {}

    /**
     * Create from legacy float-based values.
     */
    public static function fromLegacy(string $code, string $label, float|string $employeeAmount, float|string $employerAmount): self
    {
        return new self(
            code: $code,
            label: $label,
            employeeAmount: Money::toDecimal($employeeAmount),
            employerAmount: Money::toDecimal($employerAmount),
        );
    }
}
