import {
  getCountryRuleSet,
  getSupportedCountries,
  UnsupportedCountryError,
  NoApplicableRuleVersionError,
} from '../registry';

describe('country rule registry (strategy pattern)', () => {
  it('lists all supported countries', () => {
    expect(getSupportedCountries().sort()).toEqual(['KE', 'NG', 'ZA']);
  });

  it('resolves the Kenya ruleset case-insensitively', () => {
    expect(getCountryRuleSet('ke').countryCode).toBe('KE');
  });

  it('throws for an unregistered country', () => {
    expect(() => getCountryRuleSet('EG')).toThrow(UnsupportedCountryError);
  });

  it('throws when no version is effective yet for the given date', () => {
    expect(() => getCountryRuleSet('KE', new Date('2020-01-01'))).toThrow(
      NoApplicableRuleVersionError,
    );
  });

  it('picks the most recent version effective on or before the given date', () => {
    const ruleSet = getCountryRuleSet('KE', new Date('2099-01-01'));
    expect(ruleSet.version).toBe('KE-2024.2');
  });

  it('falls back to the prior version for a date before the newer one takes effect', () => {
    const ruleSet = getCountryRuleSet('KE', new Date('2024-05-01'));
    expect(ruleSet.version).toBe('KE-2024.1');
  });
});
