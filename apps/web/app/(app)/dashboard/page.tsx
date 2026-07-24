'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import {
  listCompanies,
  listEmployees,
  type Company,
  type Employee,
} from '@/lib/employees-api';
import {
  listPayrollRuns,
  getPayrollRun,
  type PayrollRun,
  type PayrollRunDetail,
} from '@/lib/payroll-api';
import { ApiError } from '@/lib/api-client';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function statusColor(status: PayrollRun['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const Dashboard = () => {
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [latestRun, setLatestRun] = useState<PayrollRunDetail | null>(null);
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

        const [employeeList, runList] = await Promise.all([
          listEmployees(primaryCompany.id),
          listPayrollRuns(primaryCompany.id),
        ]);
        if (cancelled) return;
        setEmployees(employeeList);
        setRuns(runList);

        const mostRecentCompleted = runList.find(
          (r) => r.status === 'COMPLETED',
        );
        if (mostRecentCompleted) {
          const detail = await getPayrollRun(mostRecentCompleted.id);
          if (!cancelled) setLatestRun(detail);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to load dashboard data',
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600">Error loading dashboard: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');
  const currency = company?.currency ?? 'KES';
  const monthlyPayrollTotal = latestRun?.totals?.netPay ?? null;

  const stats = [
    {
      name: 'Total Employees',
      value: company ? String(activeEmployees.length) : '—',
      icon: Users,
    },
    {
      name: 'Latest Net Payroll',
      value:
        monthlyPayrollTotal !== null
          ? formatCurrency(monthlyPayrollTotal, currency)
          : '—',
      icon: DollarSign,
    },
    {
      name: 'Pending Leave Requests',
      value: 'Coming soon',
      icon: Calendar,
    },
    {
      name: 'YTD Tax Savings',
      value: 'Coming soon',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome to your payroll management system
        </p>
      </div>

      {!company && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              No company set up for this tenant yet. Create a company under
              Settings before running payroll.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4 sm:px-0">
        {stats.map((stat) => (
          <Card key={stat.name} className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div
                className={
                  stat.value === 'Coming soon'
                    ? 'text-sm text-muted-foreground italic'
                    : 'text-2xl font-bold'
                }
              >
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payroll Runs</CardTitle>
          <CardDescription>
            Latest payroll processing activity for{' '}
            {company?.name ?? 'your company'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No payroll runs yet.
            </p>
          ) : (
            <div className="space-y-4">
              {runs.slice(0, 5).map((run) => (
                <div key={run.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{run.period} Payroll</p>
                    <p className="text-sm text-gray-600">
                      {run.totals
                        ? `${run.totals.employeeCount} employee(s)`
                        : 'Processing'}
                    </p>
                  </div>
                  <Badge className={statusColor(run.status)}>
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {latestRun && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Latest Payroll Entries</CardTitle>
                <CardDescription>
                  {latestRun.period} — {company?.name}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestRun.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.employee.firstName} {entry.employee.lastName}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.grossPay, entry.currency)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(entry.netPay, entry.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
