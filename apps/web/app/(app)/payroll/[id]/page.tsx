'use client';
import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Download, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  getPayrollRun,
  downloadPayslip,
  downloadBankExport,
  type PayrollEntry,
} from '@/lib/payroll-api';
import { ApiError } from '@/lib/api-client';
import { getPayrollStatusColor } from '@/lib/status-styles';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useSort } from '@/hooks/use-sort';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const runQuery = useQuery({
    queryKey: ['payrollRun', id],
    queryFn: () => getPayrollRun(id),
  });

  // Called before the loading/error early returns below (hooks can't be
  // conditional) — falls back to an empty array until runQuery resolves.
  const {
    sorted: sortedEntries,
    sortKey,
    direction,
    toggle,
  } = useSort(runQuery.data?.entries ?? [], {
    name: (e: PayrollEntry) =>
      `${e.employee.firstName} ${e.employee.lastName}`.toLowerCase(),
    gross: (e: PayrollEntry) => e.grossPay,
    net: (e: PayrollEntry) => e.netPay,
  });

  const handleDownloadPayslip = async (entryId: string) => {
    try {
      await downloadPayslip(entryId);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to download payslip'));
    }
  };

  const handleDownloadBankExport = async () => {
    if (!run) return;
    try {
      await downloadBankExport(run.id, run.period);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to download bank export'));
    }
  };

  if (runQuery.isLoading) return <PageSkeleton cards={3} rows={5} />;

  if (runQuery.error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">
            Error loading payroll run:{' '}
            {errorMessage(runQuery.error, 'Payroll run not found')}
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/payroll">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Payroll
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const run = runQuery.data!;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/payroll">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Payroll
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">
              Payroll Run — {run.period}
            </h1>
            <p className="text-muted-foreground">
              {run.entries.length} employee(s) •{' '}
              {run.isOffCycle ? 'Off-cycle' : 'Regular'} run
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getPayrollStatusColor(run.status)}>
              {run.status}
            </Badge>
            <Button variant="outline" onClick={handleDownloadBankExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Bank Export
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {run.totals
                ? formatCurrency(run.totals.grossPay, run.currency)
                : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {run.totals
                ? formatCurrency(run.totals.totalDeductions, run.currency)
                : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold">
              {run.totals
                ? formatCurrency(run.totals.netPay, run.currency)
                : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {run.entries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No entries in this run.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    active={sortKey === 'name'}
                    direction={direction}
                    onClick={() => toggle('name')}
                  >
                    Employee
                  </SortableTableHead>
                  <SortableTableHead
                    active={sortKey === 'gross'}
                    direction={direction}
                    onClick={() => toggle('gross')}
                  >
                    Gross
                  </SortableTableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Statutory</TableHead>
                  <SortableTableHead
                    active={sortKey === 'net'}
                    direction={direction}
                    onClick={() => toggle('net')}
                  >
                    Net Pay
                  </SortableTableHead>
                  <TableHead>Payslip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">
                        {entry.employee.firstName} {entry.employee.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.employee.employeeNumber ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.grossPay, entry.currency)}
                    </TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">
                      -{formatCurrency(entry.totalTax, entry.currency)}
                    </TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">
                      -
                      {formatCurrency(
                        entry.totalStatutoryDeductions,
                        entry.currency,
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-green-700 dark:text-green-400">
                      {formatCurrency(entry.netPay, entry.currency)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPayslip(entry.id)}
                        aria-label={`Download payslip for ${entry.employee.firstName} ${entry.employee.lastName}`}
                      >
                        <Download className="h-3 w-3" />
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
