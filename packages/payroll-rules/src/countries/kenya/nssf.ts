import { StatutoryDeductionLine } from '../../types';
import { round2 } from '../../money';
import { NSSF_TIERS } from './constants';

export function calculateNssf(grossPay: number): StatutoryDeductionLine {
  const tier1 =
    Math.min(grossPay, NSSF_TIERS.tier1.upperLimit) * NSSF_TIERS.tier1.rate;
  const tier2Base = Math.max(
    0,
    Math.min(grossPay, NSSF_TIERS.tier2.upperLimit) -
      NSSF_TIERS.tier2.lowerLimit,
  );
  const tier2 = tier2Base * NSSF_TIERS.tier2.rate;
  const employeeAmount = round2(tier1 + tier2);
  return {
    code: 'NSSF',
    label: 'NSSF',
    employeeAmount,
    employerAmount: employeeAmount,
  };
}
