export interface PricingTier {
  code: 'starter' | 'growth' | 'enterprise';
  name: string;
  /** Monthly price in the country's currency; null means "custom / talk to sales" */
  price: number | null;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export interface CountryPricing {
  countryCode: string;
  currency: string;
  tiers: PricingTier[];
}
