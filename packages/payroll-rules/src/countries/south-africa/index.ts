import {
  CountryRuleSet,
  EarningsInput,
  EarningsResult,
  PayrollCalculationInput,
  ValidationIssue,
} from '../../types';
import { round2, sum } from '../../money';
import { calculatePaye } from './paye';
import { calculateUif } from './uif';
import { SOUTH_AFRICA_V1_VERSION, SOUTH_AFRICA_V1_EFFECTIVE_FROM } from './constants';

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
  if (input.currency !== 'ZAR') {
    issues.push({ field: 'currency', message: 'South Africa payroll must be run in ZAR', severity: 'error' });
  }
  return issues;
}

export const southAfricaV1: CountryRuleSet = {
  countryCode: 'ZA',
  version: SOUTH_AFRICA_V1_VERSION,
  effectiveFrom: SOUTH_AFRICA_V1_EFFECTIVE_FROM,
  currency: 'ZAR',
  calculateEarnings,
  calculateStatutoryDeductions({ grossPay }) {
    return [calculateUif(grossPay)];
  },
  calculateTax({ grossPay, statutoryDeductions }) {
    const uif = statutoryDeductions.find((d) => d.code === 'UIF')?.employeeAmount ?? 0;
    return calculatePaye(grossPay - uif);
  },
  validate,
};

export const southAfricaRuleSets: CountryRuleSet[] = [southAfricaV1];
