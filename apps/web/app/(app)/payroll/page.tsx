'use client';
import React, { useEffect, useState } from 'react';
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
import { Calculator, Download, FileDown, Users, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { listCompanies, type Company } from '@/lib/employees-api';
import {
  listPayrollRuns,
  getPayrollRun,
  runPayroll,
  downloadPayslip,
  downloadBankExport,
  type PayrollRun,
  type PayrollRunDetail,
} from '@/lib/payroll-api';
import { ApiError } from '@/lib/api-client';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
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

function currentMonthRange() {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { period, periodStart, periodEnd };
}

export default function PayrollPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [form, setForm] = useState(currentMonthRange());

  const reload = async (companyId: string) => {
    const results = await listPayrollRuns(companyId);
    setRuns(results);
  };

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
        if (!cancelled) setCompany(companies[0]!);
        await reload(companies[0]!.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load payroll runs');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRunPayroll = async () => {
    if (!company) return;
    setIsRunning(true);
    try {
      const run = await runPayroll({ companyId: company.id, ...form });
      toast.success(`Payroll run for ${run.period} completed`, {
        description: `${run.entries.length} employee(s) processed`,
      });
      setShowRunDialog(false);
      await reload(company.id);
      // The run-payroll response's entries don't include the nested employee
      // record (only the GET detail endpoint does) — refetch for full detail.
      await handleViewRun(run.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to run payroll');
    } finally {
      setIsRunning(false);
    }
  };

  const handleViewRun = async (runId: string) => {
    try {
      const detail = await getPayrollRun(runId);
      setSelectedRun(detail);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load payroll run');
    }
  };

  const handleDownloadPayslip = async (entryId: string) => {
    try {
      await downloadPayslip(entryId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to download payslip');
    }
  };

  const handleDownloadBankExport = async (run: PayrollRun) => {
    try {
      await downloadBankExport(run.id, run.period);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to download bank export');
    }
  };

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
          <p className="text-red-600">Error loading payroll data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            No company set up for this tenant yet. Create a company under Settings before running payroll.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'COMPLETED');
  const lastNetPay = completedRuns[0]?.totals?.netPay ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground">{company.name} — run and review payroll for each period</p>
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
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                  placeholder="2026-07"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Running the same period twice returns the existing run instead of double-processing employees, unless
                salary data changed since the last run.
              </p>
              <Button onClick={handleRunPayroll} disabled={isRunning} className="w-full">
                {isRunning ? 'Running…' : 'Run Payroll'}
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
            <div className="text-2xl font-bold">{totalRuns}</div>
            <p className="text-xs text-muted-foreground">{completedRuns.length} completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Net Pay</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(lastNetPay, company.currency)}</div>
            <p className="text-xs text-muted-foreground">Most recent completed run</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Runs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.filter((r) => r.status === 'FAILED').length}</div>
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
                      <Badge className={statusColor(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell>{run.totals?.employeeCount ?? '—'}</TableCell>
                    <TableCell>
                      {run.totals ? formatCurrency(run.totals.grossPay, run.currency) : '—'}
                    </TableCell>
                    <TableCell>{run.totals ? formatCurrency(run.totals.netPay, run.currency) : '—'}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewRun(run.id)}>
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadBankExport(run)}>
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

      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle>Run Detail — {selectedRun.period}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Statutory</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Payslip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedRun.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">
                        {entry.employee.firstName} {entry.employee.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">{entry.employee.employeeNumber ?? '—'}</div>
                    </TableCell>
                    <TableCell>{formatCurrency(entry.grossPay, entry.currency)}</TableCell>
                    <TableCell className="text-red-600">-{formatCurrency(entry.totalTax, entry.currency)}</TableCell>
                    <TableCell className="text-red-600">
                      -{formatCurrency(entry.totalStatutoryDeductions, entry.currency)}
                    </TableCell>
                    <TableCell className="font-medium text-green-700">
                      {formatCurrency(entry.netPay, entry.currency)}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadPayslip(entry.id)}>
                        <Download className="h-3 w-3" />
                      </Button>
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
}
