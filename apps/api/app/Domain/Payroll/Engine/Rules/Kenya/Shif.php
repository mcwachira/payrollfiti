<?php

namespace App\Domain\Payroll\Engine\Rules\Kenya;

use App\Domain\Payroll\Engine\Money;

final class Shif
{
    /**
     * Calculate SHIF deduction for Kenya.
     *
     * @param  string  $grossPay  Gross pay as decimal string
     * @return string SHIF deduction as decimal string
     */
    public static function calculate(string $grossPay): string
    {
        $shif = Money::round2(Money::mul($grossPay, '0.025'));
        $max = '1700';

        return Money::cmp($shif, $max) <= 0 ? $shif : $max;
    }
}
