import { StatutoryDeductionLine } from '../../types';
import { round2 } from '../../money';
import { HOUSING_LEVY_RATE } from './constants';

export function calculateHousingLevy(grossPay: number): StatutoryDeductionLine {
  const amount = round2(grossPay * HOUSING_LEVY_RATE);
  return { code: 'HOUSING_LEVY', label: 'Affordable Housing Levy', employeeAmount: amount, employerAmount: amount };
}
