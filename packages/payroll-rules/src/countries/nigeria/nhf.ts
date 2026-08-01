import { StatutoryDeductionLine } from '../../types';
import { round2 } from '../../money';
import { NHF_EMPLOYEE_RATE } from './constants';

/** National Housing Fund — 2.5% of basic salary, employee-funded (no employer match). */
export function calculateNhf(basicSalary: number): StatutoryDeductionLine {
  return {
    code: 'NHF',
    label: 'National Housing Fund',
    employeeAmount: round2(basicSalary * NHF_EMPLOYEE_RATE),
    employerAmount: 0,
  };
}
