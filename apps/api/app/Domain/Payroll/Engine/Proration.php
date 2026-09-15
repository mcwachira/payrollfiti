<?php

namespace App\Domain\Payroll\Engine;

use DateTimeImmutable;

/**
 * Proration factor calculation for partial period employment.
 *
 * Returns the factor as a string to ensure precision when used
 * in monetary calculations. The factor represents the proportion
 * of the period that the employee was active (e.g., "0.5" for 50%).
 */
final class Proration
{
    public static function factor(PayrollInput $input): string
    {
        $totalDays = self::diffDaysInclusive($input->periodStart, $input->periodEnd);

        if ($totalDays <= 0) {
            return '0';
        }

        $effectiveStart = $input->employmentStartDate && $input->employmentStartDate > $input->periodStart
            ? $input->employmentStartDate
            : $input->periodStart;

        $effectiveEnd = $input->employmentEndDate && $input->employmentEndDate < $input->periodEnd
            ? $input->employmentEndDate
            : $input->periodEnd;

        if ($effectiveEnd < $effectiveStart) {
            return '0';
        }

        $workedDays = self::diffDaysInclusive($effectiveStart, $effectiveEnd);

        // Calculate factor: workedDays / totalDays
        // Use bcdiv for precision
        $factor = bcdiv((string) $workedDays, (string) $totalDays, 4);

        // Clamp to [0, 1] range
        if (bccomp($factor, '0') < 0) {
            return '0';
        }
        if (bccomp($factor, '1') > 0) {
            return '1';
        }

        return $factor;
    }

    private static function diffDaysInclusive(DateTimeImmutable $start, DateTimeImmutable $end): int
    {
        return (int) $start->diff($end)->days + 1;
    }
}
