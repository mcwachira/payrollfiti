<?php

namespace App\Domain\Payroll\Engine;

/**
 * Result of earnings calculation.
 *
 * All monetary values are stored as decimal strings for precision.
 */
final readonly class EarningsResult
{
    public function __construct(
        public string $basicSalary,
        public string $allowancesTotal,
        public string $grossPay,
    ) {}

    /**
     * Prorate earnings by a factor.
     *
     * @param  string|float  $factor  The proration factor (e.g., 0.5 for 50%)
     * @return self New prorated earnings result
     */
    public function prorate(string|float $factor): self
    {
        return new self(
            basicSalary: Money::round2(Money::mul($this->basicSalary, (string) $factor)),
            allowancesTotal: Money::round2(Money::mul($this->allowancesTotal, (string) $factor)),
            grossPay: Money::round2(Money::mul(Money::add($this->basicSalary, $this->allowancesTotal), (string) $factor)),
        );
    }

    /**
     * Create from legacy float-based values.
     */
    public static function fromLegacy(float|string $basicSalary, float|string $allowancesTotal, float|string $grossPay): self
    {
        return new self(
            basicSalary: Money::toDecimal($basicSalary),
            allowancesTotal: Money::toDecimal($allowancesTotal),
            grossPay: Money::toDecimal($grossPay),
        );
    }
}
