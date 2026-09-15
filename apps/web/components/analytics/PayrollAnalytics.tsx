'use client';

import React, { useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { DollarSign, Users, TrendingUp, Clock } from 'lucide-react';
import { DepartmentData } from '@/types/payroll-data';
import {
  listCompanies,
  listEmployees,
  type Company,
  type Employee,
} from '@/lib/employees-api';
import { listPayrollRuns } from '@/lib/payroll-api';
import { listLeaveRequests } from '@/lib/leave-api';
import { ApiError } from '@/lib/api-client';
import { CardsSkeleton } from '@/components/ui/loading-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const UNASSIGNED_DEPARTMENT = 'Unassigned';

function formatCurrency(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

interface PeriodTrendPoint {
  period: string;
  grossPay: number;
  netPay: number;
  totalDeductions: number;
  employeeCount: number;
}

interface CurrentSummary {
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
}

interface LeaveUsagePoint {
  month: string;
  totalDays: number;
  requestCount: number;
}

/** Current basic salary: the salary structure effective as of today, most-recent first. */
function currentBasicSalary(employee: Employee): number {
  const now = Date.now();
  const active = (employee.salaryStructures ?? [])
    .filter((s) => {
      const from = new Date(s.effectiveFrom).getTime();
      const to = s.effectiveTo ? new Date(s.effectiveTo).getTime() : Infinity;
      return from <= now && now <= to;
    })
    .sort(
      (a, b) =>
        new Date(b.effectiveFrom).getTime() -
        new Date(a.effectiveFrom).getTime(),
    );
  return active[0]?.basicSalary ?? 0;
}

function buildDepartmentBreakdown(employees: Employee[]): DepartmentData[] {
  const byDepartment = new Map<string, DepartmentData>();
  for (const employee of employees) {
    const name = employee.department?.trim() || UNASSIGNED_DEPARTMENT;
    const entry = byDepartment.get(name) ?? { name, count: 0, totalSalary: 0 };
    entry.count += 1;
    entry.totalSalary += currentBasicSalary(employee);
    byDepartment.set(name, entry);
  }
  return Array.from(byDepartment.values()).sort((a, b) => b.count - a.count);
}

function buildLeaveUsage(
  requests: Awaited<ReturnType<typeof listLeaveRequests>>,
): LeaveUsagePoint[] {
  const byMonth = new Map<string, LeaveUsagePoint>();
  for (const request of requests) {
    if (request.status !== 'APPROVED') continue;
    const month = request.startDate.slice(0, 7); // "YYYY-MM"
    const entry = byMonth.get(month) ?? {
      month,
      totalDays: 0,
      requestCount: 0,
    };
    entry.totalDays += request.daysRequested;
    entry.requestCount += 1;
    byMonth.set(month, entry);
  }
  return Array.from(byMonth.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  );
}

const PayrollAnalytics = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const [trend, setTrend] = useState<PeriodTrendPoint[]>([]);
  const [currentSummary, setCurrentSummary] = useState<CurrentSummary | null>(
    null,
  );
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [leaveUsage, setLeaveUsage] = useState<LeaveUsagePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const companies = await listCompanies();
        if (companies.length === 0) {
          if (!cancelled) setCompany(null);
          return;
        }
        const primaryCompany = companies[0]!;
        if (cancelled) return;
        setCompany(primaryCompany);

        const [employees, runs, leaveRequests] = await Promise.all([
          listEmployees(primaryCompany.id),
          listPayrollRuns(primaryCompany.id),
          listLeaveRequests(),
        ]);
        if (cancelled) return;

        const activeEmployeeCount = employees.filter(
          (e) => e.status === 'ACTIVE',
        ).length;

        const points: PeriodTrendPoint[] = runs
          .filter((r) => r.totals)
          .map((r) => ({
            period: r.period,
            grossPay: r.totals!.grossPay,
            netPay: r.totals!.netPay,
            totalDeductions: r.totals!.totalDeductions,
            employeeCount: r.totals!.employeeCount,
          }))
          .sort((a, b) => a.period.localeCompare(b.period));
        setTrend(points);

        const latest = points[points.length - 1];
        setCurrentSummary({
          employeeCount: activeEmployeeCount,
          totalGross: latest?.grossPay ?? 0,
          totalNet: latest?.netPay ?? 0,
          totalDeductions: latest?.totalDeductions ?? 0,
        });

        setDepartmentData(buildDepartmentBreakdown(employees));
        setLeaveUsage(buildLeaveUsage(leaveRequests));
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to load analytics data',
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardsSkeleton count={4} />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">
            Error loading analytics: {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const currency = company?.currency ?? 'KES';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Employees
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {currentSummary?.employeeCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total active workforce
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Gross Pay
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {formatCurrency(currentSummary?.totalGross ?? 0, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Latest completed run
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deductions
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {formatCurrency(currentSummary?.totalDeductions ?? 0, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Statutory + Voluntary
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Payroll</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {formatCurrency(currentSummary?.totalNet ?? 0, currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              After all deductions
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="leave-usage">Leave Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Payroll Trend Chart */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Payroll Trends</CardTitle>
                <CardDescription>
                  Gross, net, and deductions across completed payroll runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trend.length === 0 ? (
                  <p className="text-muted-foreground py-12 text-center">
                    No completed payroll runs yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis
                        tickFormatter={(value) =>
                          `${(value / 1000).toFixed(0)}K`
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatCurrency(value, currency),
                          '',
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="grossPay"
                        stroke="#8884d8"
                        name="Gross Pay"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="netPay"
                        stroke="#82ca9d"
                        name="Net Pay"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalDeductions"
                        stroke="#ffc658"
                        name="Deductions"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Department Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Distribution by Department</CardTitle>
                <CardDescription>
                  Employees without a department set are grouped under
                  &quot;Unassigned&quot;.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {departmentData.length === 0 ? (
                  <p className="text-muted-foreground py-12 text-center">
                    No employees yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={departmentData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {departmentData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Department Salary Costs */}
            <Card>
              <CardHeader>
                <CardTitle>Salary Costs by Department</CardTitle>
                <CardDescription>
                  Sum of each employee&apos;s current basic salary
                </CardDescription>
              </CardHeader>
              <CardContent>
                {departmentData.length === 0 ? (
                  <p className="text-muted-foreground py-12 text-center">
                    No employees yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis
                        tickFormatter={(value) =>
                          `${(value / 1000).toFixed(0)}K`
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatCurrency(value, currency),
                          'Total Salary',
                        ]}
                      />
                      <Bar dataKey="totalSalary" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employees Paid per Run</CardTitle>
              <CardDescription>
                Employee count processed in each completed payroll run
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trend.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center">
                  No completed payroll runs yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="employeeCount"
                      stroke="#8884d8"
                      name="Employees Paid"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave-usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Leave Usage by Month
              </CardTitle>
              <CardDescription>
                Approved leave days taken, from real leave requests. This system
                doesn&apos;t deduct leave from payroll, so there&apos;s no
                monetary figure to show here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveUsage.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center">
                  No approved leave requests yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leaveUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'totalDays' ? 'Leave Days' : 'Requests',
                      ]}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="totalDays"
                      fill="#8884d8"
                      name="Leave Days"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="requestCount"
                      fill="#82ca9d"
                      name="Requests"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PayrollAnalytics;
