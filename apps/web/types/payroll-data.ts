// Payroll Analytics Type
export type PayrollAnalytic = {
  id: number;
  period_start: string;
  period_end: string;
  total_gross: number;
  total_net: number;
  total_deductions: number;
  employee_count: number;
  created_at: string;
};

export const payrollAnalytics: PayrollAnalytic[] = [
  {
    id: 1,
    period_start: '2025-08-01',
    period_end: '2025-08-31',
    total_gross: 1250000,
    total_net: 950000,
    total_deductions: 300000,
    employee_count: 20,
    created_at: '2025-08-01T00:00:00Z',
  },
  {
    id: 2,
    period_start: '2025-07-01',
    period_end: '2025-07-31',
    total_gross: 1180000,
    total_net: 900000,
    total_deductions: 280000,
    employee_count: 19,
    created_at: '2025-07-01T00:00:00Z',
  },
];

// Current Summary Type
export type CurrentSummary = {
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  payrollCount: number;
};

export const currentSummaries: CurrentSummary = {
  employeeCount: 20,
  totalGross: 1250000,
  totalNet: 950000,
  totalDeductions: 300000,
  payrollCount: 20,
};

// Department Breakdown Type
export type DepartmentData = {
  name: string;
  count: number;
  totalSalary: number;
};

export const departmentBreakdown: DepartmentData[] = [
  { name: 'Engineering', count: 8, totalSalary: 500000 },
  { name: 'HR', count: 4, totalSalary: 200000 },
  { name: 'Finance', count: 5, totalSalary: 300000 },
  { name: 'Sales', count: 3, totalSalary: 250000 },
];

// Leave Impact Type
export type LeaveImpact = {
  month: string;
  totalDeduction: number;
  totalDays: number;
};

export const leaveImpact: LeaveImpact[] = [
  { month: 'Aug 2025', totalDeduction: 15000, totalDays: 12 },
  { month: 'Jul 2025', totalDeduction: 10000, totalDays: 8 },
  { month: 'Jun 2025', totalDeduction: 18000, totalDays: 15 },
];
