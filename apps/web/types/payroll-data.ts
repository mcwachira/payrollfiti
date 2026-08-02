// Department breakdown shape used by PayrollAnalytics — computed from real
// employee data (see buildDepartmentBreakdown in PayrollAnalytics.tsx), not
// mock data.
export type DepartmentData = {
  name: string;
  count: number;
  totalSalary: number;
};
