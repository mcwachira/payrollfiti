import {CountryPricing, PricingTier} from "./types"

const STARTER_FEATURES = [
  'Up to 50 employees',
  'PAYE & statutory deductions automation',
  'Payslip generation',
  'Employee self-service portal',
  'Email support',
];

const GROWTH_FEATURES = [
  'Up to 100 employees',
  'Everything in Starter',
  'Leave management',
  'Payroll analytics dashboard',
  'Bank export & remittance files',
  'Priority support',
];

const ENTERPRISE_FEATURES = [
  'Unlimited employees',
  'Everything in Growth',
  'Multi-country support',
  'Dedicated account manager',
  'Custom API integrations',
  'SLA-backed uptime',
];

function tiers(starterPrice:number, growthPrice:number):PricingTier[] {
 return [
   {
    code: 'starter',
      name: 'Starter',
    price: starterPrice,
    description: 'For small teams getting started with compliant payroll.',
    features: STARTER_FEATURES,
  },
  {
    code: 'growth',
      name: 'Growth',
    price: growthPrice,
    description: 'For growing businesses that need more automation.',
    features: GROWTH_FEATURES,
    highlighted: true,
  },
  {
    code: 'enterprise',
      name: 'Enterprise',
    price: null,
    description: 'For multi-country operations with custom needs.',
    features: ENTERPRISE_FEATURES,
  },
];
}

/** Static marketing pricing catalog, keyed by ISO-3166 alpha-2 country code. */
const CATALOG: Record<string, CountryPricing> = {
  KE: { countryCode: 'KE', currency: 'KES', tiers: tiers(2_500, 6_500) },
  NG: { countryCode: 'NG', currency: 'NGN', tiers: tiers(15_000, 40_000) },
  ZA: { countryCode: 'ZA', currency: 'ZAR', tiers: tiers(500, 1_200) },
};

const DEFAULT_COUNTRY = 'KE';

export function getSupportedPricingCountries(): string[] {
  return Object.keys(CATALOG);
}

/** Falls back to the default country's catalog if the given country isn't priced yet. */
export function getPricingForCountry(countryCode: string): CountryPricing {
  return CATALOG[countryCode.toUpperCase()] ?? CATALOG[DEFAULT_COUNTRY]!;
}