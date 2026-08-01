import { StatutoryDeductionLine } from '../../types';
import { round2 } from '../../money';
import { SDL_RATE } from './constants';

/**
 * Skills Development Levy — 1% of leviable gross remuneration, employer-only
 * (no employee deduction, so it never affects net pay or taxable income).
 * Employers with an annual payroll below the small-employer exemption
 * threshold (currently R500,000) are exempt; that annual-aggregate
 * exemption isn't evaluated here since this module only sees a single
 * payslip at a time — apply it at the company/tenant level if needed.
 */
export function calculateSdl(grossPay: number): StatutoryDeductionLine {
  return {
    code: 'SDL',
    label: 'Skills Development Levy',
    employeeAmount: 0,
    employerAmount: round2(grossPay * SDL_RATE),
  };
}
