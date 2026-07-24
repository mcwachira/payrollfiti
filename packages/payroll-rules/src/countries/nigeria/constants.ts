export const NIGERIA_V1_VERSION = 'NG-2024.1';
export const NIGERIA_V1_EFFECTIVE_FROM = '2024-01-01';

/** Annual PAYE bands, Personal Income Tax Act (as amended) */
export const ANNUAL_PAYE_BRACKETS = [
  { min: 0, max: 300_000, rate: 0.07 },
  { min: 300_000, max: 600_000, rate: 0.11 },
  { min: 600_000, max: 1_100_000, rate: 0.15 },
  { min: 1_100_000, max: 1_600_000, rate: 0.19 },
  { min: 1_600_000, max: 3_200_000, rate: 0.21 },
  { min: 3_200_000, max: Infinity, rate: 0.24 },
];

export const CONSOLIDATED_RELIEF_MINIMUM = 200_000;
export const CONSOLIDATED_RELIEF_GROSS_RATE = 0.01;
export const CONSOLIDATED_RELIEF_FLAT_RATE = 0.2;

/** Pension Reform Act — employee contribution rate on gross pay (basic support) */
export const PENSION_EMPLOYEE_RATE = 0.08;
export const PENSION_EMPLOYER_RATE = 0.1;
