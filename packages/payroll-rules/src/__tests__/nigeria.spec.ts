import { runPayrollCalculation, getCountryRuleSet } from '../index';
import { PayrollCalculationInput } from '../types';

const nigeria = getCountryRuleSet('NG', new Date('2026-07-01'));

function input(overrides: Partial<PayrollCalculationInput> = {}): PayrollCalculationInput {
  return {
    employeeId: 'emp-ng-1',
    countryCode: 'NG',
    currency: 'NGN',
    earnings: { basicSalary: 300_000 },
    period: { periodStart: '2026-07-01', periodEnd: '2026-07-31' },
    ...overrides,
  };
}

describe('Nigeria payroll rules (basic support)', () => {
  it('computes pension and PAYE with the Consolidated Relief Allowance', () => {
    const result = runPayrollCalculation(input(), nigeria);

    expect(result.statutoryDeductions).toEqual([
      expect.objectContaining({ code: 'PENSION', employeeAmount: 24_000, employerAmount: 30_000 }),
    ]);
    expect(result.tax.netTax).toBeCloseTo(33_534.67, 1);
    expect(result.netPay).toBeCloseTo(242_465.33, 1);
  });

  it('flags a currency mismatch', () => {
    const result = runPayrollCalculation(input({ currency: 'KES' }), nigeria);
    expect(result.validation).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'currency', severity: 'error' })]),
    );
  });

  it('handles zero salary without error', () => {
    const result = runPayrollCalculation(input({ earnings: { basicSalary: 0 } }), nigeria);
    expect(result.netPay).toBe(0);
  });
});
