import { runPayrollCalculation, computeInputHash, getCountryRuleSet } from '../index';
import { PayrollCalculationInput } from '../types';

const kenya = getCountryRuleSet('KE', new Date('2026-07-01'));

function baseInput(): PayrollCalculationInput {
  return {
    employeeId: 'emp-idem-1',
    countryCode: 'KE',
    currency: 'KES',
    earnings: { basicSalary: 80_000, allowances: { transport: 5_000 } },
    deductions: { voluntary: { sacco: 1_000 } },
    period: { periodStart: '2026-07-01', periodEnd: '2026-07-31' },
  };
}

describe('payroll engine determinism & idempotency', () => {
  it('produces byte-identical results for the same input and ruleset', () => {
    const input = baseInput();
    const first = runPayrollCalculation(input, kenya);
    const second = runPayrollCalculation(input, kenya);
    expect(second).toEqual(first);
    expect(second.inputHash).toBe(first.inputHash);
  });

  it('is unaffected by object key order (stable hashing)', () => {
    const input = baseInput();
    const reordered: PayrollCalculationInput = {
      period: input.period,
      currency: input.currency,
      countryCode: input.countryCode,
      employeeId: input.employeeId,
      earnings: input.earnings,
      deductions: input.deductions,
    };
    expect(computeInputHash(reordered, kenya.version)).toBe(computeInputHash(input, kenya.version));
  });

  it('produces a different hash when the input changes', () => {
    const input = baseInput();
    const changed = { ...input, earnings: { ...input.earnings, basicSalary: 80_001 } };
    expect(computeInputHash(changed, kenya.version)).not.toBe(computeInputHash(input, kenya.version));
  });

  it('produces a different hash when the rule version changes, even with identical input', () => {
    const input = baseInput();
    expect(computeInputHash(input, 'KE-2024.1')).not.toBe(computeInputHash(input, 'KE-2025.1'));
  });

  it('includes voluntary deductions in net pay', () => {
    const result = runPayrollCalculation(baseInput(), kenya);
    expect(result.totalVoluntaryDeductions).toBe(1_000);
    expect(result.netPay).toBe(result.grossPay - result.totalDeductions);
  });
});
