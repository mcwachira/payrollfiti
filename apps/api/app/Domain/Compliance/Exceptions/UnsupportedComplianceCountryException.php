<?php

namespace App\Domain\Compliance\Exceptions;

use Exception;

class UnsupportedComplianceCountryException extends Exception
{
    public function __construct(string $countryCode)
    {
        parent::__construct("Compliance reports are not enabled for country code: {$countryCode}");
    }
}
