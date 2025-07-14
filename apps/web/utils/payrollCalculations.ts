// Kenya Payroll Calculation Utilities
export interface PayrollInputs {
  basicSalary: number;
  transportAllowance?: number;
  housingAllowance?: number;
  medicalAllowance?: number;
  overtimeAmount?: number;
  commissionAmount?: number;
  bonusAmount?: number;
  otherAllowances?: number;
  saccoDeduction?: number;
  helbDeduction?: number;
  pensionDeduction?: number;
  loanDeductions?: number;
  otherDeductions?: number;
}

export interface PayrollResult {
  basicSalary: number;
  totalAllowances: number;
  grossTaxable: number;
  grossNonTaxable: number;
  totalGross: number;
  payeTax: number;
  nssfEmployee: number;
  nssfEmployer: number;
  nhifDeduction: number;
  totalStatutoryDeductions: number;
  totalVoluntaryDeductions: number;
  totalDeductions: number;
  netPay: number;
  breakdown: {
    transportAllowance: number;
    housingAllowance: number;
    medicalAllowance: number;
    overtimeAmount: number;
    commissionAmount: number;
    bonusAmount: number;
    otherAllowances: number;
    saccoDeduction: number;
    helbDeduction: number;
    pensionDeduction: number;
    loanDeductions: number;
    otherDeductions: number;
  };
}

// Kenya PAYE Tax Brackets (2024)
const TAX_BRACKETS = [
  { min: 0, max: 24000, rate: 0.1, relief: 0 },
  { min: 24001, max: 32333, rate: 0.25, relief: 3600 },
  { min: 32334, max: 500000, rate: 0.3, relief: 5283.25 },
  { min: 500001, max: 800000, rate: 0.325, relief: 17783.25 },
  { min: 800001, max: Infinity, rate: 0.35, relief: 37783.25 },
];

// Personal Relief
const PERSONAL_RELIEF = 2400;

// NSSF Rates (2024)
const NSSF_RATES = {
  tier1: { min: 0, max: 7000, rate: 0.06 },
  tier2: { min: 7001, max: 36000, rate: 0.06 },
};

// Calculate PAYE Tax
export function calculatePAYE(grossTaxable: number): number {
  let tax = 0;

  for (const bracket of TAX_BRACKETS) {
    if (grossTaxable > bracket.min - 1) {
      const taxableInBracket =
        Math.min(grossTaxable, bracket.max) - (bracket.min - 1);
      tax += taxableInBracket * bracket.rate;

      if (grossTaxable <= bracket.max) {
        break;
      }
    }
  }

  // Apply personal relief
  tax = Math.max(0, tax - PERSONAL_RELIEF);

  return Math.round(tax);
}

// Calculate NSSF Contributions
export function calculateNSSF(grossSalary: number): {
  employee: number;
  employer: number;
} {
  const tier1Amount =
    Math.min(grossSalary, NSSF_RATES.tier1.max) * NSSF_RATES.tier1.rate;
  const tier2Amount =
    grossSalary > NSSF_RATES.tier2.min
      ? Math.min(
          grossSalary - NSSF_RATES.tier2.min + 1,
          NSSF_RATES.tier2.max - NSSF_RATES.tier2.min + 1,
        ) * NSSF_RATES.tier2.rate
      : 0;

  const employee = Math.round(tier1Amount + tier2Amount);
  const employer = employee; // Equal contribution

  return { employee, employer };
}

// Calculate NHIF Deduction
export function calculateNHIF(grossSalary: number): number {
  // NHIF rates are stored in database, but for calculation we'll use the standard rates
  if (grossSalary <= 5999) return 150;
  if (grossSalary <= 7999) return 300;
  if (grossSalary <= 11999) return 400;
  if (grossSalary <= 14999) return 500;
  if (grossSalary <= 19999) return 600;
  if (grossSalary <= 24999) return 750;
  if (grossSalary <= 29999) return 850;
  if (grossSalary <= 34999) return 900;
  if (grossSalary <= 39999) return 950;
  if (grossSalary <= 44999) return 1000;
  if (grossSalary <= 49999) return 1100;
  if (grossSalary <= 59999) return 1200;
  if (grossSalary <= 69999) return 1300;
  if (grossSalary <= 79999) return 1400;
  if (grossSalary <= 89999) return 1500;
  if (grossSalary <= 99999) return 1600;
  return 1700;
}

// Main payroll calculation function
export function calculatePayroll(inputs: PayrollInputs): PayrollResult {
  const {
    basicSalary,
    transportAllowance = 0,
    housingAllowance = 0,
    medicalAllowance = 0,
    overtimeAmount = 0,
    commissionAmount = 0,
    bonusAmount = 0,
    otherAllowances = 0,
    saccoDeduction = 0,
    helbDeduction = 0,
    pensionDeduction = 0,
    loanDeductions = 0,
    otherDeductions = 0,
  } = inputs;

  // Calculate total allowances
  const totalAllowances =
    transportAllowance +
    housingAllowance +
    medicalAllowance +
    overtimeAmount +
    commissionAmount +
    bonusAmount +
    otherAllowances;

  // Calculate gross pay
  const totalGross = basicSalary + totalAllowances;

  // For Kenya, most allowances are taxable except for specific exemptions
  const grossTaxable = totalGross;
  const grossNonTaxable = 0;

  // Calculate NSSF (deducted before PAYE)
  const nssf = calculateNSSF(grossTaxable);
  const nssfEmployee = nssf.employee;
  const nssfEmployer = nssf.employer;

  // Calculate taxable income after NSSF
  const taxableAfterNSSF = grossTaxable - nssfEmployee;

  // Calculate PAYE
  const payeTax = calculatePAYE(taxableAfterNSSF);

  // Calculate NHIF
  const nhifDeduction = calculateNHIF(grossTaxable);

  // Calculate total deductions
  const totalStatutoryDeductions = payeTax + nssfEmployee + nhifDeduction;
  const totalVoluntaryDeductions =
    saccoDeduction +
    helbDeduction +
    pensionDeduction +
    loanDeductions +
    otherDeductions;
  const totalDeductions = totalStatutoryDeductions + totalVoluntaryDeductions;

  // Calculate net pay
  const netPay = totalGross - totalDeductions;

  return {
    basicSalary,
    totalAllowances,
    grossTaxable,
    grossNonTaxable,
    totalGross,
    payeTax,
    nssfEmployee,
    nssfEmployer,
    nhifDeduction,
    totalStatutoryDeductions,
    totalVoluntaryDeductions,
    totalDeductions,
    netPay,
    breakdown: {
      transportAllowance,
      housingAllowance,
      medicalAllowance,
      overtimeAmount,
      commissionAmount,
      bonusAmount,
      otherAllowances,
      saccoDeduction,
      helbDeduction,
      pensionDeduction,
      loanDeductions,
      otherDeductions,
    },
  };
}

// Format currency for display
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(amount);
}

// Calculate year-to-date totals
export function calculateYTD(payrollRecords: PayrollResult[]): PayrollResult {
  return payrollRecords.reduce(
    (ytd, record) => ({
      basicSalary: ytd.basicSalary + record.basicSalary,
      totalAllowances: ytd.totalAllowances + record.totalAllowances,
      grossTaxable: ytd.grossTaxable + record.grossTaxable,
      grossNonTaxable: ytd.grossNonTaxable + record.grossNonTaxable,
      totalGross: ytd.totalGross + record.totalGross,
      payeTax: ytd.payeTax + record.payeTax,
      nssfEmployee: ytd.nssfEmployee + record.nssfEmployee,
      nssfEmployer: ytd.nssfEmployer + record.nssfEmployer,
      nhifDeduction: ytd.nhifDeduction + record.nhifDeduction,
      totalStatutoryDeductions:
        ytd.totalStatutoryDeductions + record.totalStatutoryDeductions,
      totalVoluntaryDeductions:
        ytd.totalVoluntaryDeductions + record.totalVoluntaryDeductions,
      totalDeductions: ytd.totalDeductions + record.totalDeductions,
      netPay: ytd.netPay + record.netPay,
      breakdown: {
        transportAllowance:
          ytd.breakdown.transportAllowance +
          record.breakdown.transportAllowance,
        housingAllowance:
          ytd.breakdown.housingAllowance + record.breakdown.housingAllowance,
        medicalAllowance:
          ytd.breakdown.medicalAllowance + record.breakdown.medicalAllowance,
        overtimeAmount:
          ytd.breakdown.overtimeAmount + record.breakdown.overtimeAmount,
        commissionAmount:
          ytd.breakdown.commissionAmount + record.breakdown.commissionAmount,
        bonusAmount: ytd.breakdown.bonusAmount + record.breakdown.bonusAmount,
        otherAllowances:
          ytd.breakdown.otherAllowances + record.breakdown.otherAllowances,
        saccoDeduction:
          ytd.breakdown.saccoDeduction + record.breakdown.saccoDeduction,
        helbDeduction:
          ytd.breakdown.helbDeduction + record.breakdown.helbDeduction,
        pensionDeduction:
          ytd.breakdown.pensionDeduction + record.breakdown.pensionDeduction,
        loanDeductions:
          ytd.breakdown.loanDeductions + record.breakdown.loanDeductions,
        otherDeductions:
          ytd.breakdown.otherDeductions + record.breakdown.otherDeductions,
      },
    }),
    {
      basicSalary: 0,
      totalAllowances: 0,
      grossTaxable: 0,
      grossNonTaxable: 0,
      totalGross: 0,
      payeTax: 0,
      nssfEmployee: 0,
      nssfEmployer: 0,
      nhifDeduction: 0,
      totalStatutoryDeductions: 0,
      totalVoluntaryDeductions: 0,
      totalDeductions: 0,
      netPay: 0,
      breakdown: {
        transportAllowance: 0,
        housingAllowance: 0,
        medicalAllowance: 0,
        overtimeAmount: 0,
        commissionAmount: 0,
        bonusAmount: 0,
        otherAllowances: 0,
        saccoDeduction: 0,
        helbDeduction: 0,
        pensionDeduction: 0,
        loanDeductions: 0,
        otherDeductions: 0,
      },
    },
  );
}
