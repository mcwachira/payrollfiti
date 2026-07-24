export const SOUTH_AFRICA_V1_VERSION = 'ZA-2024.1';
export const SOUTH_AFRICA_V1_EFFECTIVE_FROM = '2024-03-01';

/** Annual PAYE bands, SARS 2024/25 tax year */
export const ANNUAL_PAYE_BRACKETS = [
  { min: 0, max: 237_100, rate: 0.18, base: 0 },
  { min: 237_100, max: 370_500, rate: 0.26, base: 42_678 },
  { min: 370_500, max: 512_800, rate: 0.31, base: 77_362 },
  { min: 512_800, max: 673_000, rate: 0.36, base: 121_475 },
  { min: 673_000, max: 857_900, rate: 0.39, base: 179_147 },
  { min: 857_900, max: 1_817_000, rate: 0.41, base: 251_258 },
  { min: 1_817_000, max: Infinity, rate: 0.45, base: 644_489 },
];

/** Primary rebate, under-65, 2024/25 tax year */
export const ANNUAL_PRIMARY_REBATE = 17_235;

/** UIF — 1% employee + 1% employer, capped at the remuneration ceiling */
export const UIF_RATE = 0.01;
export const UIF_MONTHLY_CEILING = 17_712;
