export type ISODate = string;

export interface EarningsInput {
  basicSalary: number;
  allowances?: Record<string, number>;
  overtimeAmount?: number;
  commissionAmount?: number;
  bonusAmount?: number;
}

export interface DeductionsInput {
  voluntary?: Record<string, number>;
}

export interface EmploymentPeriod {
  /** Payroll period start, e.g. first day of the month being run */
  periodStart: ISODate;
  /** Payroll period end, e.g. last day of the month being run */
  periodEnd: ISODate;
  /** Set when the employee joined mid-period, to drive proration */
  employmentStartDate?: ISODate;
  /** Set when the employee exited mid-period, to drive proration */
  employmentEndDate?: ISODate;
}

export interface PayrollCalculationInput {
  employeeId: string;
  countryCode: string;
  currency: string;
  earnings: EarningsInput;
  deductions?: DeductionsInput;
  period: EmploymentPeriod;
}

export interface EarningsResult {
  basicSalary: number;
  totalAllowances: number;
  overtimeAmount: number;
  commissionAmount: number;
  bonusAmount: number;
  grossPay: number;
  allowanceBreakdown: Record<string, number>;
}

export interface StatutoryDeductionLine {
  code: string;
  label: string;
  employeeAmount: number;
  employerAmount: number;
}

export interface TaxResult {
  code: string;
  taxableIncome: number;
  grossTax: number;
  relief: number;
  netTax: number;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DeductionContext {
  grossPay: number;
  earnings: EarningsResult;
}

export interface TaxContext {
  grossPay: number;
  statutoryDeductions: StatutoryDeductionLine[];
}

/**
 * Strategy-pattern contract every country payroll module implements.
 * Implementations must be pure — no I/O, no clock reads, no randomness —
 * so a given (input, ruleset) pair always yields the same result.
 */
export interface CountryRuleSet {
  countryCode: string;
  /** Opaque version tag recorded on every payroll run for reproducibility */
  version: string;
  effectiveFrom: ISODate;
  currency: string;
  calculateEarnings(input: EarningsInput): EarningsResult;
  calculateStatutoryDeductions(ctx: DeductionContext): StatutoryDeductionLine[];
  calculateTax(ctx: TaxContext): TaxResult;
  validate(input: PayrollCalculationInput): ValidationIssue[];
}

export interface PayrollCalculationResult {
  employeeId: string;
  countryCode: string;
  currency: string;
  ruleVersion: string;
  /** 1 = full period worked, <1 = mid-period joiner/leaver */
  prorationFactor: number;
  earnings: EarningsResult;
  statutoryDeductions: StatutoryDeductionLine[];
  voluntaryDeductions: Record<string, number>;
  totalVoluntaryDeductions: number;
  tax: TaxResult;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  validation: ValidationIssue[];
  /** Stable hash of (input, ruleVersion) — used upstream to key idempotent payroll runs */
  inputHash: string;
}
