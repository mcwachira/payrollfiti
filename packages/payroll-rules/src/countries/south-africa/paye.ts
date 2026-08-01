import { TaxResult } from '../../types';
import { round2 } from '../../money';
import { ANNUAL_PAYE_BRACKETS, ANNUAL_PRIMARY_REBATE } from './constants';

function calculateAnnualGrossTax(annualTaxableIncome: number): number {
  const income = Math.max(0, annualTaxableIncome);
  const bracket =
    [...ANNUAL_PAYE_BRACKETS].reverse().find((b) => income > b.min) ??
    ANNUAL_PAYE_BRACKETS[0]!;
  return bracket.base + (income - bracket.min) * bracket.rate;
}

/**
 * Basic PAYE support: annualizes the monthly taxable base, applies SARS
 * graduated bands and the primary rebate, then divides back to monthly.
 */
export function calculatePaye(monthlyTaxableIncome: number): TaxResult {
  const annualTaxable = Math.max(0, monthlyTaxableIncome) * 12;
  const annualGrossTax = calculateAnnualGrossTax(annualTaxable);
  const annualNetTax = Math.max(0, annualGrossTax - ANNUAL_PRIMARY_REBATE);
  const netTax = round2(annualNetTax / 12);
  return {
    code: 'PAYE',
    taxableIncome: round2(monthlyTaxableIncome),
    grossTax: round2(annualGrossTax / 12),
    relief: round2(ANNUAL_PRIMARY_REBATE / 12),
    netTax,
  };
}
