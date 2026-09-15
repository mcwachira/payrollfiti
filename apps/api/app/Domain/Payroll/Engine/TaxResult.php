<?php

namespace App\Domain\Payroll\Engine;

/**
 * Result of tax calculation.
 *
 * All monetary values are stored as decimal strings for precision.
 */
final readonly class TaxResult
{
    public function __construct(
        public string $grossTax,
        public string $netTax,
    ) {}

    /**
     * Create from legacy float-based values.
     */
    public static function fromLegacy(float|string $grossTax, float|string $netTax): self
    {
        return new self(
            grossTax: Money::toDecimal($grossTax),
            netTax: Money::toDecimal($netTax),
        );
    }
}
