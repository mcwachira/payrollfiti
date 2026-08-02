'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calculator,
  FileDown,
  Users,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { listCompanies } from '@/lib/employees-api';
import {
  listPayrollRuns,
  runPayroll,
  downloadBankExport,
  type PayrollRun,
} from '@/lib/payroll-api';
import { ApiError } from '@/lib/api-client';
import { getPayrollStatusColor } from '@/lib/status-styles';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function currentMonthRange() {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { period, periodStart, periodEnd };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function PayrollPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [form, setForm] = useState(currentMonthRange());

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });
  const company = companiesQuery.data?.[0] ?? null;

  const runsQuery = useQuery({
    queryKey: ['payrollRuns', company?.id],
    queryFn: () => listPayrollRuns(company!.id),
    enabled: !!company,
  });

  const runPayrollMutation = useMutation({
    mutationFn: runPayroll,
    onSuccess: (run) => {
      toast.success(`Payroll run for ${run.period} completed`, {
        description: `${run.entries.length} employee(s) processed`,
      });
      setShowRunDialog(false);
      queryClient.invalidateQueries({ queryKey: ['payrollRuns', company?.id] });
      router.push(`/payroll/${run.id}`);
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Failed to run payroll'));
    },
  });

  const handleDownloadBankExport = async (run: PayrollRun) => {
    try {
      await downloadBankExport(run.id, run.period);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to download bank export'));
    }
  };

  const isLoading =
    companiesQuery.isPending || (!!company && runsQuery.isPending);
  const error = companiesQuery.error ?? runsQuery.error;

  if (isLoading) {
    return <PageSkeleton cards={3} rows={5} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">
            Error loading payroll data:{' '}
            {errorMessage(error, 'Failed to load payroll runs')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            No company set up for this tenant yet. Create a company under
            Settings before running payroll.
          </p>
        </CardContent>
      </Card>
    );
  }

  const runs = runsQuery.data ?? [];
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'COMPLETED');
  const lastNetPay = completedRuns[0]?.totals?.netPay ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold">Payroll Management</h1>
          <p className="text-muted-foreground">
            {company.name} — run and review payroll for each period
          </p>
        </div>
        <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
          <DialogTrigger asChild>
            <Button>
              <Calculator className="mr-2 h-4 w-4" />
              New Payroll Run
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Run Payroll</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="period">Period (YYYY-MM)</Label>
                <Input
                  id="period"
                  value={form.period}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, period: e.target.value }))
                  }
                  placeholder="2026-07"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={form.periodStart}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, periodStart: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, periodEnd: e.target.value }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Running the same period twice returns the existing run instead
                of double-processing employees, unless salary data changed since
                the last run.
              </p>
              <Button
                onClick={() =>
                  runPayrollMutation.mutate({ companyId: company.id, ...form })
                }
                disabled={runPayrollMutation.isPending}
                className="w-full"
              >
                {runPayrollMutation.isPending ? 'Running…' : 'Run Payroll'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payroll Runs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">{totalRuns}</div>
            <p className="text-xs text-muted-foreground">
              {completedRuns.length} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Net Pay</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {formatCurrency(lastNetPay, company.currency)}
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent completed run
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Runs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {runs.filter((r) => r.status === 'FAILED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No payroll runs yet. Start one with &ldquo;New Payroll Run&rdquo;.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.period}</TableCell>
                    <TableCell>
                      <Badge className={getPayrollStatusColor(run.status)}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{run.totals?.employeeCount ?? '—'}</TableCell>
                    <TableCell>
                      {run.totals
                        ? formatCurrency(run.totals.grossPay, run.currency)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {run.totals
                        ? formatCurrency(run.totals.netPay, run.currency)
                        : '—'}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/payroll/${run.id}`}>View</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadBankExport(run)}
                        aria-label={`Download bank export for ${run.period}`}
                      >
                        <FileDown className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
