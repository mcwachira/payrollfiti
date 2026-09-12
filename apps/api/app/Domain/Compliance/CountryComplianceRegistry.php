<?php

namespace App\Domain\Compliance;

use App\Domain\Compliance\Exceptions\UnsupportedComplianceCountryException;
use App\Domain\Compliance\Generators\KenyaComplianceGenerator;
use App\Domain\Compliance\Generators\NigeriaComplianceGenerator;
use App\Domain\Compliance\Generators\SouthAfricaComplianceGenerator;
use App\Domain\Compliance\Generators\UgandaComplianceGenerator;

final class CountryComplianceRegistry
{
    /** @var array<int, CountryComplianceGenerator> */
    private array $generators;

    public function __construct()
    {
        $this->generators = [
            new KenyaComplianceGenerator,
            new NigeriaComplianceGenerator,
            new SouthAfricaComplianceGenerator,
            new UgandaComplianceGenerator,
        ];
    }

    public function resolve(string $countryCode, ?string $reportCode = null): CountryComplianceGenerator
    {
        $countryCode = strtoupper($countryCode);

        foreach ($this->generators as $generator) {
            if ($generator->countryCode() !== $countryCode) {
                continue;
            }

            if ($reportCode !== null && $generator->reportCode() !== $reportCode) {
                continue;
            }

            return $generator;
        }

        throw new UnsupportedComplianceCountryException($countryCode);
    }

    /** @return array<int, string> */
    public function supportedCountries(): array
    {
        return array_values(array_unique(array_map(fn (CountryComplianceGenerator $generator) => $generator->countryCode(), $this->generators)));
    }
}
