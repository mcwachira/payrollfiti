'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { listCompanies, listEmployees } from '@/lib/employees-api';
import { getMyTenant } from '@/lib/tenants-api';
import {
  downloadNhifRemittanceCsv,
  downloadNssfRemittanceCsv,
  downloadP10Csv,
  downloadP9,
  downloadPayeRemittanceCsv,
  downloadPensionRemittanceCsv,
  downloadNhfRemittanceCsv,
  downloadEmp201Csv,
  downloadIrp5,
} from '@/lib/compliance-reports-api';
import { ApiError } from '@/lib/api-client';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function CompliancePage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [employeeId, setEmployeeId] = useState<string>('');
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });
  const company = companiesQuery.data?.[0] ?? null;

  const tenantQuery = useQuery({
    queryKey: ['tenant', 'me'],
    queryFn: getMyTenant,
  });
  const countryCode = tenantQuery.data?.countryCode;

  const employeesQuery = useQuery({
    queryKey: ['employees', company?.id],
    queryFn: () => listEmployees(company!.id),
    enabled: !!company,
  });

  const p10Mutation = useMutation({
    mutationFn: () => downloadP10Csv(company!.id, period),
    onError: (error) =>
      toast.error('Could not generate PAYE summary', {
        description: errorMessage(
          error,
          'No payroll run found for that period',
        ),
      }),
  });

  const nssfMutation = useMutation({
    mutationFn: () => downloadNssfRemittanceCsv(company!.id, period),
    onError: (error) =>
      toast.error('Could not generate NSSF remittance file', {
        description: errorMessage(
          error,
          'No payroll run found for that period',
        ),
      }),
  });

  const nhifMutation = useMutation({
    mutationFn: () => downloadNhifRemittanceCsv(company!.id, period),
    onError: (error) =>
      toast.error('Could not generate NHIF/SHIF remittance file', {
        description: errorMessage(
          error,
          'No payroll run found for that period',
        ),
      }),
  });

  const p9Mutation = useMutation({
    mutationFn: () => downloadP9(company!.id, employeeId, taxYear),
    onError: (error) =>
      toast.error('Could not generate P9 certificate', {
        description: errorMessage(
          error,
          'No payroll entries found for this employee in that tax year',
        ),
      }),
  });

  const payeMutation = useMutation({
    mutationFn: () => downloadPayeRemittanceCsv(company!.id, period),
    onError: (error) =>
      toast.error('Could not generate PAYE remittance schedule', {
        description: errorMessage(
          error,
          'No payroll run found for that period',
        ),
      }),
  });

  const pensionMutation = useMutation({
    mutationFn: () => downloadPensionRemittanceCsv(company!.id, period),
    onError: (error) =>
      toast.error('Could not generate pension remittance schedule', {
        description: errorMessage(
          error,
          'No payroll run found for that period',
        ),
      }),
  });

  const nhfMutation = useMutation({
    mutationFn: () => downloadNhfRemittanceCsv(company!.id, period),
    onError: (error) =>
      toast.error('Could not generate NHF remittance schedule', {
        description: errorMessage(
          error,
          'No payroll run found for that period',
        ),
      }),
  });

  const emp201Mutation = useMutation({
    mutationFn: () => downloadEmp201Csv(company!.id, period),
    onError: (error) =>
      toast.error('Could not generate EMP201 declaration', {
        description: errorMessage(
          error,
          'No payroll run found for that period',
        ),
      }),
  });

  const irp5Mutation = useMutation({
    mutationFn: () => downloadIrp5(company!.id, employeeId, taxYear),
    onError: (error) =>
      toast.error('Could not generate IRP5 certificate', {
        description: errorMessage(
          error,
          'No payroll entries found for this employee in that tax year',
        ),
      }),
  });

  if (companiesQuery.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">
          Statutory Compliance Reports
        </h1>
        <p className="text-muted-foreground">
          Generate statutory filing documents from real payroll data
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <p className="text-sm">
          These reports are generated from your actual payroll runs and are
          ready for manual filing. This app does not submit filings to any tax
          or statutory authority on your behalf — there is no e-filing
          integration.
        </p>
      </div>

      {!company ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No company found. Add a company before generating compliance
            reports.
          </CardContent>
        </Card>
      ) : countryCode === 'KE' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Monthly Statutory Filings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-2">
                <Label htmlFor="period">Payroll period</Label>
                <Input
                  id="period"
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Uses the most recent completed payroll run for this period.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  disabled={p10Mutation.isPending}
                  onClick={() => p10Mutation.mutate()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  PAYE Summary (P10)
                </Button>
                <Button
                  variant="outline"
                  disabled={nssfMutation.isPending}
                  onClick={() => nssfMutation.mutate()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  NSSF Remittance
                </Button>
                <Button
                  variant="outline"
                  disabled={nhifMutation.isPending}
                  onClick={() => nhifMutation.mutate()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  NHIF/SHIF Remittance
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>P9 Tax Deduction Certificate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesQuery.data?.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxYear">Tax year</Label>
                  <Input
                    id="taxYear"
                    value={taxYear}
                    onChange={(e) => setTaxYear(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    disabled={!employeeId || p9Mutation.isPending}
                    onClick={() => p9Mutation.mutate()}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate P9
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : countryCode === 'NG' ? (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Statutory Filings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="period">Payroll period</Label>
              <Input
                id="period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Uses the most recent completed payroll run for this period.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                disabled={payeMutation.isPending}
                onClick={() => payeMutation.mutate()}
              >
                <Download className="mr-2 h-4 w-4" />
                PAYE Remittance Schedule
              </Button>
              <Button
                variant="outline"
                disabled={pensionMutation.isPending}
                onClick={() => pensionMutation.mutate()}
              >
                <Download className="mr-2 h-4 w-4" />
                Pension Remittance (PenCom)
              </Button>
              <Button
                variant="outline"
                disabled={nhfMutation.isPending}
                onClick={() => nhfMutation.mutate()}
              >
                <Download className="mr-2 h-4 w-4" />
                NHF Remittance (FMBN)
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : countryCode === 'ZA' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Monthly Statutory Filings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-2">
                <Label htmlFor="period">Payroll period</Label>
                <Input
                  id="period"
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Uses the most recent completed payroll run for this period.
                </p>
              </div>

              <Button
                variant="outline"
                disabled={emp201Mutation.isPending}
                onClick={() => emp201Mutation.mutate()}
              >
                <Download className="mr-2 h-4 w-4" />
                EMP201 Declaration (SARS)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>IRP5 Employee Tax Certificate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesQuery.data?.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxYear">Tax year</Label>
                  <Input
                    id="taxYear"
                    value={taxYear}
                    onChange={(e) => setTaxYear(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    disabled={!employeeId || irp5Mutation.isPending}
                    onClick={() => irp5Mutation.mutate()}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate IRP5
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Statutory compliance reports aren&apos;t available for this
            tenant&apos;s country yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
