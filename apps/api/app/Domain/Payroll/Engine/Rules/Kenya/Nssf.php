<?php

namespace App\Domain\Payroll\Engine\Rules\Kenya;

use App\Domain\Payroll\Engine\Money;

final class Nssf
{
    /**
     * Calculate NSSF deduction for Kenya.
     *
     * @param  string  $grossPay  Gross pay as decimal string
     * @return string NSSF deduction as decimal string
     */
    public static function calculate(string $grossPay): string
    {
        $nssf = Money::round2(Money::mul($grossPay, '0.06'));
        $max = '600';

        // Return the minimum of calculated NSSF and maximum
        return Money::cmp($nssf, $max) <= 0 ? $nssf : $max;
    }
}
