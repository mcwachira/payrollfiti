<?php

namespace App\Domain\Payroll\Engine;

use App\Domain\Payroll\Engine\Exceptions\NoApplicableRuleVersionException;
use App\Domain\Payroll\Engine\Exceptions\UnsupportedCountryException;
use App\Domain\Payroll\Engine\Rules\Kenya\Kenya2024RuleSet;
use App\Domain\Payroll\Engine\Rules\Kenya\Kenya2025RuleSet;
use App\Domain\Payroll\Engine\Rules\Nigeria\Nigeria2024RuleSet;
use App\Domain\Payroll\Engine\Rules\SouthAfrica\SouthAfrica2024RuleSet;
use DateTimeImmutable;

final class RuleRegistry
{
    /** @var array<string, array<int, CountryRuleSet>> */
    private array $ruleSets;

    public function __construct()
    {
        $this->ruleSets = [
            'KE' => [new Kenya2024RuleSet, new Kenya2025RuleSet],
            'NG' => [new Nigeria2024RuleSet],
            'ZA' => [new SouthAfrica2024RuleSet],
        ];
    }

    public function resolve(string $countryCode, DateTimeImmutable $effectiveDate): CountryRuleSet
    {
        $countryCode = strtoupper($countryCode);
        $candidates = $this->ruleSets[$countryCode] ?? throw new UnsupportedCountryException($countryCode);

        $applicable = array_values(array_filter(
            $candidates,
            fn (CountryRuleSet $ruleSet) => $ruleSet->effectiveFrom() <= $effectiveDate,
        ));

        usort($applicable, fn (CountryRuleSet $a, CountryRuleSet $b) => $b->effectiveFrom() <=> $a->effectiveFrom());

        return $applicable[0] ?? throw new NoApplicableRuleVersionException($countryCode, $effectiveDate);
    }

    public function byVersion(string $countryCode, string $version): CountryRuleSet
    {
        foreach ($this->ruleSets[strtoupper($countryCode)] ?? [] as $ruleSet) {
            if ($ruleSet->version() === $version) {
                return $ruleSet;
            }
        }

        throw new UnsupportedCountryException("{$countryCode}@{$version}");
    }
}
