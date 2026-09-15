<?php

namespace App\Domain\Payroll\Engine\Exceptions;

use RuntimeException;

final class NoApplicableRuleVersionException extends RuntimeException
{
    public function __construct(string $countryCode, \DateTimeImmutable $effectiveDate)
    {
        parent::__construct("No payroll rule version found for {$countryCode} effective on {$effectiveDate->format('Y-m-d')}");
    }
}
