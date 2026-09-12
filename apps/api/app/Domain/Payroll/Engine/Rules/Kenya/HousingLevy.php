<?php

namespace App\Domain\Payroll\Engine\Rules\Kenya;

use App\Domain\Payroll\Engine\Money;

final class HousingLevy
{
    /**
     * Calculate Housing Levy deduction for Kenya.
     *
     * @param  string  $grossPay  Gross pay as decimal string
     * @return string Housing Levy deduction as decimal string
     */
    public static function calculate(string $grossPay): string
    {
        return Money::round2(Money::mul($grossPay, '0.015'));
    }
}
