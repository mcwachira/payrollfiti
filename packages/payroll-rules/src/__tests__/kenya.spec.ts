import {
  runPayrollCalculation,
  getCountryRuleSet,
  getRuleSetByVersion,
} from '../index';
import { PayrollCalculationInput } from '../types';

// 2026-07-01 is after the 1 Oct 2024 NHIF -> SHIF transition, so this
// resolves to the KE-2024.2 (SHIF) ruleset.
const kenya = getCountryRuleSet('KE', new Date('2026-07-01'));

function input(
  overrides: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    employeeId: 'emp-1',
    countryCode: 'KE',
    currency: 'KES',
    earnings: { basicSalary: 50_000 },
    period: { periodStart: '2026-07-01', periodEnd: '2026-07-31' },
    ...overrides,
  };
}

describe('Kenya payroll rules', () => {
  it('computes PAYE, NSSF, SHIF, Housing Levy and net pay for a mid-band salary', () => {
    const result = runPayrollCalculation(input(), kenya);

    expect(result.statutoryDeductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NSSF', employeeAmount: 2160 }),
        expect.objectContaining({ code: 'SHIF', employeeAmount: 1375 }),
        expect.objectContaining({ code: 'HOUSING_LEVY', employeeAmount: 750 }),
      ]),
    );
    expect(result.tax.netTax).toBeCloseTo(6_097.85, 2);
    expect(result.grossPay).toBe(50_000);
    expect(result.totalDeductions).toBeCloseTo(10_382.85, 2);
    expect(result.netPay).toBeCloseTo(39_617.15, 2);
  });

  it('applies personal relief so low earners owe zero PAYE', () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: 3_000 } }),
      kenya,
    );
    expect(result.tax.netTax).toBe(0);
    expect(result.netPay).toBeCloseTo(2_475, 2);
  });

  it("handles zero salary without error, still applying SHIF's minimum contribution", () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: 0 } }),
      kenya,
    );
    expect(result.grossPay).toBe(0);
    expect(result.tax.netTax).toBe(0);
    expect(result.statutoryDeductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SHIF', employeeAmount: 300 }),
      ]),
    );
    expect(result.netPay).toBe(result.grossPay - result.totalDeductions);
  });

  it('flags negative salary as a validation error but still computes a result', () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: -1_000 } }),
      kenya,
    );
    expect(result.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'basicSalary', severity: 'error' }),
      ]),
    );
  });

  it('flags a currency mismatch', () => {
    const result = runPayrollCalculation(input({ currency: 'USD' }), kenya);
    expect(result.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'currency', severity: 'error' }),
      ]),
    );
  });

  it('prorates basic salary for a mid-period joiner', () => {
    const full = runPayrollCalculation(input(), kenya);
    const prorated = runPayrollCalculation(
      input({
        period: {
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          employmentStartDate: '2026-07-16',
        },
      }),
      kenya,
    );
    // 16 days worked out of 31, factor is rounded to 4dp before being applied
    expect(prorated.prorationFactor).toBeCloseTo(16 / 31, 4);
    expect(prorated.earnings.basicSalary).toBeCloseTo(
      full.earnings.basicSalary * prorated.prorationFactor,
      2,
    );
    expect(prorated.netPay).toBeLessThan(full.netPay);
  });

  it('does not prorate overtime, commission or bonus — those are already actuals', () => {
    const result = runPayrollCalculation(
      input({
        earnings: {
          basicSalary: 50_000,
          overtimeAmount: 1_000,
          bonusAmount: 2_000,
        },
        period: {
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          employmentStartDate: '2026-07-16',
        },
      }),
      kenya,
    );
    expect(result.earnings.overtimeAmount).toBe(1_000);
    expect(result.earnings.bonusAmount).toBe(2_000);
  });
});

describe('Kenya NHIF -> SHIF transition (SHIF Act 2023, effective 2024-10-01)', () => {
  it('resolves KE-2024.1 (NHIF) for periods before the transition date', () => {
    const ruleSet = getCountryRuleSet('KE', new Date('2024-09-30'));
    expect(ruleSet.version).toBe('KE-2024.1');
  });

  it('resolves KE-2024.2 (SHIF) on and after the transition date', () => {
    expect(getCountryRuleSet('KE', new Date('2024-10-01')).version).toBe(
      'KE-2024.2',
    );
    expect(getCountryRuleSet('KE', new Date('2026-07-01')).version).toBe(
      'KE-2024.2',
    );
  });

  it('keeps historical NHIF runs reproducible via the pinned ruleset version', () => {
    const nhifRuleSet = getRuleSetByVersion('KE', 'KE-2024.1');
    const result = runPayrollCalculation(
      input({ period: { periodStart: '2024-06-01', periodEnd: '2024-06-30' } }),
      nhifRuleSet,
    );
    expect(result.statutoryDeductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NHIF', employeeAmount: 1_200 }),
      ]),
    );
  });

  it('applies the SHIF minimum contribution of KES 300 for low earners', () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: 5_000 } }),
      kenya,
    );
    // 5,000 * 2.75% = 137.50, below the 300 minimum
    expect(result.statutoryDeductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SHIF', employeeAmount: 300 }),
      ]),
    );
  });

  it('applies the flat 2.75% SHIF rate once it exceeds the minimum', () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: 100_000 } }),
      kenya,
    );
    expect(result.statutoryDeductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SHIF', employeeAmount: 2_750 }),
      ]),
    );
  });
});
