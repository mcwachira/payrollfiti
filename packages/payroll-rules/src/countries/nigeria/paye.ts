import { TaxResult } from '../../types';
import { round2 } from '../../money';
import {
  ANNUAL_PAYE_BRACKETS,
  CONSOLIDATED_RELIEF_MINIMUM,
  CONSOLIDATED_RELIEF_GROSS_RATE,
  CONSOLIDATED_RELIEF_FLAT_RATE,
} from './constants';

function calculateConsolidatedReliefAllowance(annualGross: number): number {
  const grossBased = Math.max(CONSOLIDATED_RELIEF_MINIMUM, annualGross * CONSOLIDATED_RELIEF_GROSS_RATE);
  return grossBased + annualGross * CONSOLIDATED_RELIEF_FLAT_RATE;
}

function calculateAnnualGrossTax(annualTaxableIncome: number): number {
  const income = Math.max(0, annualTaxableIncome);
  let tax = 0;
  for (const bracket of ANNUAL_PAYE_BRACKETS) {
    if (income <= bracket.min) break;
    const upper = Math.min(income, bracket.max);
    tax += (upper - bracket.min) * bracket.rate;
  }
  return tax;
}

/**
 * Basic PAYE support: annualizes the monthly taxable base, applies the
 * Consolidated Relief Allowance and graduated bands, then divides back
 * down to a monthly deduction.
 */
export function calculatePaye(monthlyIncomeBeforeRelief: number): TaxResult {
  const annualGross = Math.max(0, monthlyIncomeBeforeRelief) * 12;
  const relief = calculateConsolidatedReliefAllowance(annualGross);
  const annualTaxableIncome = Math.max(0, annualGross - relief);
  const annualTax = calculateAnnualGrossTax(annualTaxableIncome);
  const netTax = round2(annualTax / 12);
  return {
    code: 'PAYE',
    taxableIncome: round2(annualTaxableIncome / 12),
    grossTax: netTax,
    relief: round2(relief / 12),
    netTax,
  };
}
