import { StatutoryDeductionLine } from '../../types';
import { NHIF_BANDS } from './constants';

export function calculateNhif(grossPay: number): StatutoryDeductionLine {
  const band =
    NHIF_BANDS.find((b) => grossPay <= b.max) ??
    NHIF_BANDS[NHIF_BANDS.length - 1]!;
  return {
    code: 'NHIF',
    label: 'NHIF',
    employeeAmount: band.amount,
    employerAmount: 0,
  };
}
