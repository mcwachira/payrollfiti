import { runPayrollCalculation, getCountryRuleSet } from '../index';
import { PayrollCalculationInput } from '../types';

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
  it('computes PAYE, NSSF, NHIF, Housing Levy and net pay for a mid-band salary', () => {
    const result = runPayrollCalculation(input(), kenya);

    expect(result.statutoryDeductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NSSF', employeeAmount: 2160 }),
        expect.objectContaining({ code: 'NHIF', employeeAmount: 1200 }),
        expect.objectContaining({ code: 'HOUSING_LEVY', employeeAmount: 750 }),
      ]),
    );
    expect(result.tax.netTax).toBeCloseTo(6150.35, 2);
    expect(result.grossPay).toBe(50_000);
    expect(result.totalDeductions).toBeCloseTo(10_260.35, 2);
    expect(result.netPay).toBeCloseTo(39_739.65, 2);
  });

  it('applies personal relief so low earners owe zero PAYE', () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: 3_000 } }),
      kenya,
    );
    expect(result.tax.netTax).toBe(0);
    expect(result.netPay).toBeCloseTo(2_625, 2);
  });

  it("handles zero salary without error, still applying NHIF's flat minimum band", () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: 0 } }),
      kenya,
    );
    expect(result.grossPay).toBe(0);
    expect(result.tax.netTax).toBe(0);
    expect(result.statutoryDeductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NHIF', employeeAmount: 150 }),
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
