<?php

namespace App\Domain\Payroll\Engine\Rules\Kenya;

use App\Domain\Payroll\Engine\Money;

final class Nhif
{
    /**
     * Calculate NHIF deduction for Kenya.
     *
     * @param  string  $grossPay  Gross pay as decimal string
     * @return string NHIF deduction as decimal string
     */
    public static function calculate(string $grossPay): string
    {
        $nhif = Money::round2(Money::mul($grossPay, '0.025'));
        $max = '1700';

        return Money::cmp($nhif, $max) <= 0 ? $nhif : $max;
    }
}
