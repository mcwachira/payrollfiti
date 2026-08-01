'use client';

import { useQuery } from '@tanstack/react-query';
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
import { listCompanies, listEmployees } from '@/lib/employees-api';
import { listPayrollRuns, getPayrollRun } from '@/lib/payroll-api';
import { ApiError } from '@/lib/api-client';
import { getPayrollStatusColor } from '@/lib/status-styles';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

const Dashboard = () => {
  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });
  const company = companiesQuery.data?.[0] ?? null;

  const employeesQuery = useQuery({
    queryKey: ['employees', company?.id],
    queryFn: () => listEmployees(company!.id),
    enabled: !!company,
  });

  const runsQuery = useQuery({
    queryKey: ['payrollRuns', company?.id],
    queryFn: () => listPayrollRuns(company!.id),
    enabled: !!company,
  });

  const mostRecentCompleted = runsQuery.data?.find(
    (r) => r.status === 'COMPLETED',
  );

  const latestRunQuery = useQuery({
    queryKey: ['payrollRun', mostRecentCompleted?.id],
    queryFn: () => getPayrollRun(mostRecentCompleted!.id),
    enabled: !!mostRecentCompleted,
  });

  const isLoading =
    companiesQuery.isPending ||
    (!!company && (employeesQuery.isPending || runsQuery.isPending));

  const error =
    companiesQuery.error ??
    employeesQuery.error ??
    runsQuery.error ??
    latestRunQuery.error;

  if (isLoading) {
    return <PageSkeleton cards={4} rows={5} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">
            Error loading dashboard:{' '}
            {errorMessage(error, 'Failed to load dashboard data')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const employees = employeesQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const latestRun = latestRunQuery.data ?? null;

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
        <h1 className="text-2xl font-extrabold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={
                  stat.value === 'Coming soon'
                    ? 'text-sm text-muted-foreground italic'
                    : 'text-2xl font-extrabold'
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
                    <p className="text-sm text-muted-foreground">
                      {run.totals
                        ? `${run.totals.employeeCount} employee(s)`
                        : 'Processing'}
                    </p>
                  </div>
                  <Badge className={getPayrollStatusColor(run.status)}>
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
