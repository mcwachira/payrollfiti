import { StatutoryDeductionLine } from '../../types';
import { round2 } from '../../money';
import { SHIF_RATE, SHIF_MINIMUM_CONTRIBUTION } from './constants';

export function calculateShif(grossPay: number): StatutoryDeductionLine {
  const employeeAmount = Math.max(
    SHIF_MINIMUM_CONTRIBUTION,
    round2(grossPay * SHIF_RATE),
  );
  return {
    code: 'SHIF',
    label: 'Social Health Insurance Fund',
    employeeAmount,
    employerAmount: 0,
  };
}
