import { EmploymentPeriod, EarningsResult } from './types';
import { round4, round2 } from './money';

function diffDaysInclusive(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

/**
 * Fraction of the payroll period actually worked, based on employment
 * start/end dates overlapping the period. Returns 1 for a full period,
 * 0 if there is no overlap at all.
 */
export function calculateProrationFactor(period: EmploymentPeriod): number {
  const periodStart = new Date(period.periodStart);
  const periodEnd = new Date(period.periodEnd);
  const totalDays = diffDaysInclusive(periodStart, periodEnd);
  if (totalDays <= 0) return 0;

  const employmentStart = period.employmentStartDate
    ? new Date(period.employmentStartDate)
    : undefined;
  const employmentEnd = period.employmentEndDate
    ? new Date(period.employmentEndDate)
    : undefined;

  const effectiveStart =
    employmentStart && employmentStart > periodStart
      ? employmentStart
      : periodStart;
  const effectiveEnd =
    employmentEnd && employmentEnd < periodEnd ? employmentEnd : periodEnd;

  if (effectiveEnd < effectiveStart) return 0;

  const workedDays = diffDaysInclusive(effectiveStart, effectiveEnd);
  return Math.min(1, Math.max(0, round4(workedDays / totalDays)));
}

/**
 * Prorates the fixed pay elements (basic salary, allowances) for a
 * mid-period joiner/leaver. Overtime, commission and bonus are left
 * untouched — they represent actuals already tied to days worked or
 * one-off events, not a rate that should be scaled by attendance.
 */
export function prorateEarnings(
  earnings: EarningsResult,
  factor: number,
): EarningsResult {
  if (factor >= 1) return earnings;
  const allowanceBreakdown: Record<string, number> = {};
  for (const [key, value] of Object.entries(earnings.allowanceBreakdown)) {
    allowanceBreakdown[key] = round2(value * factor);
  }
  const basicSalary = round2(earnings.basicSalary * factor);
  const totalAllowances = round2(earnings.totalAllowances * factor);
  const { overtimeAmount, commissionAmount, bonusAmount } = earnings;
  return {
    basicSalary,
    totalAllowances,
    overtimeAmount,
    commissionAmount,
    bonusAmount,
    allowanceBreakdown,
    grossPay: round2(
      basicSalary +
        totalAllowances +
        overtimeAmount +
        commissionAmount +
        bonusAmount,
    ),
  };
}
