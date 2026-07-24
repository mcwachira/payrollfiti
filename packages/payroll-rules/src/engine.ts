import { createHash } from 'crypto';
import {
  CountryRuleSet,
  PayrollCalculationInput,
  PayrollCalculationResult,
} from './types';
import { calculateProrationFactor, prorateEarnings } from './proration';
import { round2, sum, stableStringify } from './money';

export function computeInputHash(input: PayrollCalculationInput, ruleVersion: string): string {
  return createHash('sha256').update(stableStringify({ input, ruleVersion })).digest('hex');
}

/**
 * Pure calculation entrypoint: (input, ruleSet) -> result, with no side
 * effects and no hidden state. Same arguments always produce the same
 * result, which is what lets callers use `inputHash` as an idempotency
 * key for payroll runs instead of re-deriving it themselves.
 */
export function runPayrollCalculation(
  input: PayrollCalculationInput,
  ruleSet: CountryRuleSet,
): PayrollCalculationResult {
  const validation = ruleSet.validate(input);
  const prorationFactor = calculateProrationFactor(input.period);

  const fullEarnings = ruleSet.calculateEarnings(input.earnings);
  const earnings = prorateEarnings(fullEarnings, prorationFactor);

  const statutoryDeductions = ruleSet.calculateStatutoryDeductions({
    grossPay: earnings.grossPay,
    earnings,
  });
  const tax = ruleSet.calculateTax({ grossPay: earnings.grossPay, statutoryDeductions });

  const voluntaryDeductions = input.deductions?.voluntary ?? {};
  const totalVoluntaryDeductions = round2(sum(Object.values(voluntaryDeductions)));

  const totalStatutoryEmployeeAmount = sum(statutoryDeductions.map((d) => d.employeeAmount));
  const totalDeductions = round2(totalStatutoryEmployeeAmount + tax.netTax + totalVoluntaryDeductions);
  const netPay = round2(earnings.grossPay - totalDeductions);

  return {
    employeeId: input.employeeId,
    countryCode: ruleSet.countryCode,
    currency: input.currency,
    ruleVersion: ruleSet.version,
    prorationFactor,
    earnings,
    statutoryDeductions,
    voluntaryDeductions,
    totalVoluntaryDeductions,
    tax,
    totalDeductions,
    grossPay: earnings.grossPay,
    netPay,
    validation,
    inputHash: computeInputHash(input, ruleSet.version),
  };
}
