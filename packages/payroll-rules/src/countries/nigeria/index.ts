import {
  CountryRuleSet,
  EarningsInput,
  EarningsResult,
  PayrollCalculationInput,
  ValidationIssue,
} from '../../types';
import { round2, sum } from '../../money';
import { calculatePaye } from './paye';
import { calculatePension } from './pension';
import { NIGERIA_V1_VERSION, NIGERIA_V1_EFFECTIVE_FROM } from './constants';

function calculateEarnings(input: EarningsInput): EarningsResult {
  const allowanceBreakdown = { ...(input.allowances ?? {}) };
  const totalAllowances = round2(sum(Object.values(allowanceBreakdown)));
  const overtimeAmount = input.overtimeAmount ?? 0;
  const commissionAmount = input.commissionAmount ?? 0;
  const bonusAmount = input.bonusAmount ?? 0;
  const basicSalary = input.basicSalary;
  return {
    basicSalary,
    totalAllowances,
    overtimeAmount,
    commissionAmount,
    bonusAmount,
    allowanceBreakdown,
    grossPay: round2(basicSalary + totalAllowances + overtimeAmount + commissionAmount + bonusAmount),
  };
}

function validate(input: PayrollCalculationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.earnings.basicSalary < 0) {
    issues.push({ field: 'basicSalary', message: 'Basic salary cannot be negative', severity: 'error' });
  }
  if (input.currency !== 'NGN') {
    issues.push({ field: 'currency', message: 'Nigeria payroll must be run in NGN', severity: 'error' });
  }
  return issues;
}

export const nigeriaV1: CountryRuleSet = {
  countryCode: 'NG',
  version: NIGERIA_V1_VERSION,
  effectiveFrom: NIGERIA_V1_EFFECTIVE_FROM,
  currency: 'NGN',
  calculateEarnings,
  calculateStatutoryDeductions({ grossPay }) {
    return [calculatePension(grossPay)];
  },
  calculateTax({ grossPay, statutoryDeductions }) {
    const pension = statutoryDeductions.find((d) => d.code === 'PENSION')?.employeeAmount ?? 0;
    return calculatePaye(grossPay - pension);
  },
  validate,
};

export const nigeriaRuleSets: CountryRuleSet[] = [nigeriaV1];
