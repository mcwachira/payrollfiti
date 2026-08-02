/**
 * `AccountingPlatformClient.syncPayrollExpense`'s `run.totals` is typed
 * `unknown` in the shared interface (it's opaque JSON on PayrollRun) — this
 * narrows it to the shape PayrollService.aggregateTotals actually produces,
 * defaulting to zero for anything malformed rather than throwing, since a
 * best-effort accounting sync shouldn't crash on an unexpected shape.
 */
export interface PayrollTotals {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export function parsePayrollTotals(totals: unknown): PayrollTotals {
  const record = (totals ?? {}) as Record<string, unknown>;
  const numberOrZero = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return {
    grossPay: numberOrZero(record.grossPay),
    totalDeductions: numberOrZero(record.totalDeductions),
    netPay: numberOrZero(record.netPay),
  };
}
