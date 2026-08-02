import {
  CountryRuleSet,
  EarningsInput,
  EarningsResult,
  PayrollCalculationInput,
  ValidationIssue,
} from '../../types';
import { round2, sum } from '../../money';
import { calculatePaye } from './paye';
import { calculateNssf } from './nssf';
import { calculateNhif } from './nhif';
import { calculateShif } from './shif';
import { calculateHousingLevy } from './housingLevy';
import {
  KENYA_V1_VERSION,
  KENYA_V1_EFFECTIVE_FROM,
  KENYA_V2_VERSION,
  KENYA_V2_EFFECTIVE_FROM,
} from './constants';

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
    grossPay: round2(
      basicSalary +
        totalAllowances +
        overtimeAmount +
        commissionAmount +
        bonusAmount,
    ),
  };
}

function validate(input: PayrollCalculationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.earnings.basicSalary < 0) {
    issues.push({
      field: 'basicSalary',
      message: 'Basic salary cannot be negative',
      severity: 'error',
    });
  }
  if (input.currency !== 'KES') {
    issues.push({
      field: 'currency',
      message: 'Kenya payroll must be run in KES',
      severity: 'error',
    });
  }
  return issues;
}

export const kenyaV1: CountryRuleSet = {
  countryCode: 'KE',
  version: KENYA_V1_VERSION,
  effectiveFrom: KENYA_V1_EFFECTIVE_FROM,
  currency: 'KES',
  calculateEarnings,
  calculateStatutoryDeductions({ grossPay }) {
    return [
      calculateNssf(grossPay),
      calculateNhif(grossPay),
      calculateHousingLevy(grossPay),
    ];
  },
  calculateTax({ grossPay, statutoryDeductions }) {
    // NSSF, NHIF and Housing Levy contributions are all pre-tax deductible (Finance Act 2023)
    const deductible = sum(statutoryDeductions.map((d) => d.employeeAmount));
    return calculatePaye(grossPay - deductible);
  },
  validate,
};

/**
 * NHIF was replaced by SHIF (SHIF Act 2023) on 1 Oct 2024. This version
 * applies to any payroll period on or after that date; kenyaV1 remains the
 * applicable ruleset for earlier periods so historical runs stay reproducible.
 */
export const kenyaV2: CountryRuleSet = {
  countryCode: 'KE',
  version: KENYA_V2_VERSION,
  effectiveFrom: KENYA_V2_EFFECTIVE_FROM,
  currency: 'KES',
  calculateEarnings,
  calculateStatutoryDeductions({ grossPay }) {
    return [
      calculateNssf(grossPay),
      calculateShif(grossPay),
      calculateHousingLevy(grossPay),
    ];
  },
  calculateTax({ grossPay, statutoryDeductions }) {
    // NSSF, SHIF and Housing Levy contributions are all pre-tax deductible (Finance Act 2023)
    const deductible = sum(statutoryDeductions.map((d) => d.employeeAmount));
    return calculatePaye(grossPay - deductible);
  },
  validate,
};

export const kenyaRuleSets: CountryRuleSet[] = [kenyaV1, kenyaV2];
