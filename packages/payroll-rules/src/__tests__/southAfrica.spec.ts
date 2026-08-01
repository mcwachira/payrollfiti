import { runPayrollCalculation, getCountryRuleSet } from '../index';
import { PayrollCalculationInput } from '../types';

const southAfrica = getCountryRuleSet('ZA', new Date('2026-07-01'));

function input(
  overrides: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    employeeId: 'emp-za-1',
    countryCode: 'ZA',
    currency: 'ZAR',
    earnings: { basicSalary: 30_000 },
    period: { periodStart: '2026-07-01', periodEnd: '2026-07-31' },
    ...overrides,
  };
}

describe('South Africa payroll rules (basic support)', () => {
  it('computes UIF (capped), SDL, and PAYE with the primary rebate', () => {
    const result = runPayrollCalculation(input(), southAfrica);

    expect(result.statutoryDeductions).toEqual([
      expect.objectContaining({
        code: 'UIF',
        employeeAmount: 177.12,
        employerAmount: 177.12,
      }),
      expect.objectContaining({
        code: 'SDL',
        employeeAmount: 0,
        employerAmount: 300,
      }),
    ]);
    // PAYE is computed on gross pay, not gross-minus-UIF: UIF contributions
    // are not tax-deductible under SARS rules (unlike retirement funds).
    expect(result.tax.netTax).toBeCloseTo(4_783.08, 1);
    expect(result.netPay).toBeCloseTo(25_039.8, 1);
  });

  it('caps UIF contribution at the monthly remuneration ceiling for high earners', () => {
    const result = runPayrollCalculation(
      input({ earnings: { basicSalary: 100_000 } }),
      southAfrica,
    );
    const uif = result.statutoryDeductions.find((d) => d.code === 'UIF');
    expect(uif?.employeeAmount).toBe(177.12);
  });

  it('flags a currency mismatch', () => {
    const result = runPayrollCalculation(
      input({ currency: 'NGN' }),
      southAfrica,
    );
    expect(result.validation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'currency', severity: 'error' }),
      ]),
    );
  });
});
