import { StatutoryDeductionLine } from '../../types';
import { round2 } from '../../money';
import { PENSION_EMPLOYEE_RATE, PENSION_EMPLOYER_RATE } from './constants';

export function calculatePension(grossPay: number): StatutoryDeductionLine {
  return {
    code: 'PENSION',
    label: 'Pension (PRA 2014)',
    employeeAmount: round2(grossPay * PENSION_EMPLOYEE_RATE),
    employerAmount: round2(grossPay * PENSION_EMPLOYER_RATE),
  };
}
