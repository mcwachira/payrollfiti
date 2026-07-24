import { TaxResult } from '../../types';
import { round2 } from '../../money';
import { PAYE_BRACKETS, PERSONAL_RELIEF } from './constants';

function calculateGrossPaye(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  let tax = 0;
  for (const bracket of PAYE_BRACKETS) {
    if (income <= bracket.min) break;
    const upper = Math.min(income, bracket.max);
    tax += (upper - bracket.min) * bracket.rate;
  }
  return tax;
}

export function calculatePaye(taxableIncome: number): TaxResult {
  const grossTax = round2(calculateGrossPaye(taxableIncome));
  const netTax = round2(Math.max(0, grossTax - PERSONAL_RELIEF));
  return {
    code: 'PAYE',
    taxableIncome: round2(Math.max(0, taxableIncome)),
    grossTax,
    relief: PERSONAL_RELIEF,
    netTax,
  };
}
