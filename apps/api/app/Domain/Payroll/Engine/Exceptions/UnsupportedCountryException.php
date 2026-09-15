<?php

namespace App\Domain\Payroll\Engine\Exceptions;

use RuntimeException;

final class UnsupportedCountryException extends RuntimeException
{
    public function __construct(string $countryCode)
    {
        parent::__construct("Unsupported country code: {$countryCode}");
    }
}
