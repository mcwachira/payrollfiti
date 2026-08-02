export const KENYA_V1_VERSION = 'KE-2024.1';
export const KENYA_V1_EFFECTIVE_FROM = '2024-01-01';

/** Upper-bound-exclusive PAYE bands (KRA, per Finance Act 2023) */
export const PAYE_BRACKETS = [
  { min: 0, max: 24_000, rate: 0.1 },
  { min: 24_000, max: 32_333, rate: 0.25 },
  { min: 32_333, max: 500_000, rate: 0.3 },
  { min: 500_000, max: 800_000, rate: 0.325 },
  { min: 800_000, max: Infinity, rate: 0.35 },
];

export const PERSONAL_RELIEF = 2_400;

export const NSSF_TIERS = {
  tier1: { lowerLimit: 0, upperLimit: 7_000, rate: 0.06 },
  tier2: { lowerLimit: 7_000, upperLimit: 36_000, rate: 0.06 },
};

export const NHIF_BANDS: Array<{ max: number; amount: number }> = [
  { max: 5_999, amount: 150 },
  { max: 7_999, amount: 300 },
  { max: 11_999, amount: 400 },
  { max: 14_999, amount: 500 },
  { max: 19_999, amount: 600 },
  { max: 24_999, amount: 750 },
  { max: 29_999, amount: 850 },
  { max: 34_999, amount: 900 },
  { max: 39_999, amount: 950 },
  { max: 44_999, amount: 1_000 },
  { max: 49_999, amount: 1_100 },
  { max: 59_999, amount: 1_200 },
  { max: 69_999, amount: 1_300 },
  { max: 79_999, amount: 1_400 },
  { max: 89_999, amount: 1_500 },
  { max: 99_999, amount: 1_600 },
  { max: Infinity, amount: 1_700 },
];

/** Affordable Housing Levy — 1.5% employee + 1.5% employer, uncapped */
export const HOUSING_LEVY_RATE = 0.015;

export const KENYA_V2_VERSION = 'KE-2024.2';
/** SHIF Act 2023 commencement date — NHIF was replaced by SHIF on this date */
export const KENYA_V2_EFFECTIVE_FROM = '2024-10-01';

/** Social Health Insurance Fund — replaced NHIF from 1 Oct 2024 (SHIF Act 2023) */
export const SHIF_RATE = 0.0275;
export const SHIF_MINIMUM_CONTRIBUTION = 300;
