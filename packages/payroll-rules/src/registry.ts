import { CountryRuleSet } from './types';
import { kenyaRuleSets } from './countries/kenya';
import { nigeriaRuleSets } from './countries/nigeria';
import { southAfricaRuleSets } from './countries/south-africa';

export class UnsupportedCountryError extends Error {
  constructor(countryCode: string) {
    super(`No payroll rules registered for country "${countryCode}"`);
    this.name = 'UnsupportedCountryError';
  }
}

export class NoApplicableRuleVersionError extends Error {
  constructor(countryCode: string, effectiveDate: Date) {
    super(
      `No "${countryCode}" ruleset is effective on ${effectiveDate.toISOString()}`,
    );
    this.name = 'NoApplicableRuleVersionError';
  }
}

/** Strategy registry: one config-driven list of versioned rulesets per country */
const REGISTRY: Record<string, CountryRuleSet[]> = {
  KE: kenyaRuleSets,
  NG: nigeriaRuleSets,
  ZA: southAfricaRuleSets,
};

export function getSupportedCountries(): string[] {
  return Object.keys(REGISTRY);
}

export function getRuleSetByVersion(
  countryCode: string,
  version: string,
): CountryRuleSet {
  const ruleSets = REGISTRY[countryCode.toUpperCase()];
  const ruleSet = ruleSets?.find((rs) => rs.version === version);
  if (!ruleSet) {
    throw new UnsupportedCountryError(`${countryCode}@${version}`);
  }
  return ruleSet;
}

/**
 * Resolves the ruleset that applies for a country on a given date, picking
 * the most recent version whose `effectiveFrom` is on or before that date.
 * This is what makes rules versioned: a payroll run always records which
 * version it used, and re-running the same period later reproduces it by
 * pinning `effectiveDate` to the period rather than "now".
 */
export function getCountryRuleSet(
  countryCode: string,
  effectiveDate: Date = new Date(),
): CountryRuleSet {
  const ruleSets = REGISTRY[countryCode.toUpperCase()];
  if (!ruleSets || ruleSets.length === 0) {
    throw new UnsupportedCountryError(countryCode);
  }

  const applicable = ruleSets
    .filter(
      (rs) => new Date(rs.effectiveFrom).getTime() <= effectiveDate.getTime(),
    )
    .sort(
      (a, b) =>
        new Date(b.effectiveFrom).getTime() -
        new Date(a.effectiveFrom).getTime(),
    );

  const ruleSet = applicable[0];
  if (!ruleSet) {
    throw new NoApplicableRuleVersionError(countryCode, effectiveDate);
  }
  return ruleSet;
}
