import { getPricingForCountry, getSupportedPricingCountries } from '../catalog';
import { formatPrice } from '../format';

describe('pricing catalog', () => {
  it('lists KE, NG, ZA as supported countries', () => {
    expect(getSupportedPricingCountries().sort()).toEqual(['KE', 'NG', 'ZA']);
  });

  it('returns country-specific currency and tiers', () => {
    const ke = getPricingForCountry('KE');
    expect(ke.currency).toBe('KES');
    expect(ke.tiers.map((t) => t.code)).toEqual([
      'starter',
      'growth',
      'enterprise',
    ]);
    expect(ke.tiers[0]!.price).toBe(2_500);

    const ng = getPricingForCountry('ng');
    expect(ng.currency).toBe('NGN');
    expect(ng.tiers[0]!.price).toBe(15_000);
  });

  it('falls back to KE for an unpriced country', () => {
    const fallback = getPricingForCountry('US');
    expect(fallback.countryCode).toBe('KE');
  });

  it('enterprise tier has no fixed price', () => {
    const za = getPricingForCountry('ZA');
    const enterprise = za.tiers.find((t) => t.code === 'enterprise');
    expect(enterprise?.price).toBeNull();
  });
});

describe('formatPrice', () => {
  it('formats a numeric price with the currency code', () => {
    expect(formatPrice(2_500, 'KES')).toContain('2,500');
    expect(formatPrice(2_500, 'KES')).toContain('KES');
  });

  it('formats a null price as "Custom"', () => {
    expect(formatPrice(null, 'KES')).toBe('Custom');
  });
});
