import { StatutoryDeductionLine } from '../../types';
import { round2 } from '../../money';
import { UIF_RATE, UIF_MONTHLY_CEILING } from './constants';

export function calculateUif(grossPay: number): StatutoryDeductionLine {
  const contributionBase = Math.min(grossPay, UIF_MONTHLY_CEILING);
  const amount = round2(contributionBase * UIF_RATE);
  return { code: 'UIF', label: 'UIF', employeeAmount: amount, employerAmount: amount };
}
