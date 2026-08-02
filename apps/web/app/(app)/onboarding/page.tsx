'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Plus, Trash2, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@repo/pricing';
import { getMyTenant, createCompany, type Tenant } from '@/lib/tenants-api';
import {
  bulkCreateEmployees,
  addSalaryStructure,
  type Company,
  type BulkCreateEmployeeResult,
} from '@/lib/employees-api';
import { calculatePayroll } from '@/lib/payroll-calculator-api';
import { listPlans, subscribe, type Plan } from '@/lib/billing-api';
import { getCountryName } from '@/lib/countries';
import { ApiError } from '@/lib/api-client';
import { SalaryComponentsSettings } from '@/components/settings/SalaryComponentsSettings';

/**
 * Guided post-signup setup. Replaces the previous behavior of dropping a
 * new admin straight onto /dashboard with no Company — POST
 * /tenants/companies has existed on the backend all along, but nothing in
 * the frontend ever called it, so every new tenant landed on an empty
 * dashboard with no obvious next step. This wizard is that missing step,
 * plus the natural ones that follow it (add people, see what payroll will
 * actually cost, pick a plan).
 */

const STEPS = [
  'Company',
  'Payroll Rules',
  'Pay Components',
  'Add Employees',
  'Preview',
  'Plan',
] as const;

const COUNTRY_RULE_SUMMARY: Record<string, { label: string; lines: string[] }> =
  {
    KE: {
      label: 'Kenya',
      lines: [
        'PAYE (graduated bands + personal relief)',
        'NSSF (2-tier)',
        'SHIF (2.75% of gross)',
        'Affordable Housing Levy (1.5%)',
      ],
    },
    NG: {
      label: 'Nigeria',
      lines: [
        'PAYE (graduated bands + consolidated relief)',
        'Pension (8% employee / 10% employer)',
        'National Housing Fund (2.5% of basic)',
      ],
    },
    ZA: {
      label: 'South Africa',
      lines: [
        'PAYE (SARS annual bands, primary rebate)',
        'UIF (1% employee / 1% employer, capped)',
        'Skills Development Levy (1%, employer-only)',
      ],
    },
  };

const STORAGE_KEY = 'payrollfiti-onboarding-v1';

interface DraftEmployee {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  basicSalary: string;
  status: 'pending' | 'saving' | 'saved' | 'error';
  error?: string;
  employeeId?: string;
}

function newDraft(): DraftEmployee {
  return {
    key: crypto.randomUUID(),
    firstName: '',
    lastName: '',
    email: '',
    basicSalary: '',
    status: 'pending',
  };
}

function readSavedStep(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;
  try {
    return Math.min(STEPS.length - 1, Math.max(0, JSON.parse(raw).step ?? 0));
  } catch {
    return 0;
  }
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [drafts, setDrafts] = useState<DraftEmployee[]>([newDraft()]);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);

  // Save & resume: persist just the step index + confirmed company across a
  // refresh or an accidental tab close. Draft employee rows are
  // intentionally NOT persisted — they're either already saved server-side
  // (recoverable via the real employees list) or not worth resurrecting a
  // half-typed form for.
  useEffect(() => {
    setStep(readSavedStep());
  }, []);
  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step, companyId: company?.id ?? null }),
    );
  }, [step, company]);

  const tenantQuery = useQuery({
    queryKey: ['tenant', 'me'],
    queryFn: getMyTenant,
  });
  const tenant: Tenant | undefined = tenantQuery.data;
  const currency = company?.currency ?? tenant?.defaultCurrency ?? 'KES';
  const ruleSummary = tenant
    ? COUNTRY_RULE_SUMMARY[tenant.countryCode]
    : undefined;

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
    enabled: step === 5,
  });

  const createCompanyMutation = useMutation({
    mutationFn: () =>
      createCompany({
        name: companyName.trim(),
        currency: tenant?.defaultCurrency,
      }),
    onSuccess: (created) => {
      setCompany(created);
      toast.success(`${created.name} is set up`);
      setStep(1);
    },
    onError: (error) =>
      toast.error('Could not create the company', {
        description: error instanceof ApiError ? error.message : undefined,
      }),
  });

  const subscribeMutation = useMutation({
    mutationFn: (planCode: string) => subscribe({ planCode }),
    onSuccess: () => {
      toast.success('Subscription activated');
      finishOnboarding();
    },
    onError: (error) =>
      toast.error('Could not activate the plan', {
        description: error instanceof ApiError ? error.message : undefined,
      }),
  });

  function finishOnboarding() {
    window.localStorage.removeItem(STORAGE_KEY);
    router.push('/dashboard');
  }

  function updateDraft(key: string, patch: Partial<DraftEmployee>) {
    setDrafts((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }
  function removeDraft(key: string) {
    setDrafts((rows) => rows.filter((r) => r.key !== key));
  }

  /**
   * One request for every pending row via POST /employees/bulk — each row
   * is reported success/failure independently server-side, so a bad email
   * on row 4 doesn't stop rows 1-3 (or 5+) from landing. Salary structures
   * still go through individual addSalaryStructure calls afterward, since
   * bulk-create only covers the Employee row itself.
   */
  async function saveAllDrafts() {
    if (!company) return;
    const pending = drafts.filter(
      (r) =>
        (r.status === 'pending' || r.status === 'error') &&
        r.firstName.trim() &&
        r.lastName.trim() &&
        r.email.trim(),
    );
    if (pending.length === 0) return;

    pending.forEach((row) =>
      updateDraft(row.key, { status: 'saving', error: undefined }),
    );

    let results: BulkCreateEmployeeResult[];
    try {
      results = await bulkCreateEmployees(
        pending.map((row) => ({
          companyId: company.id,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: row.email.trim(),
        })),
      );
    } catch (error) {
      pending.forEach((row) =>
        updateDraft(row.key, {
          status: 'error',
          error: error instanceof ApiError ? error.message : 'Failed to save',
        }),
      );
      return;
    }

    await Promise.all(
      results.map(async (result, i) => {
        const row = pending[i]!;
        if (!result.success) {
          updateDraft(row.key, { status: 'error', error: result.error });
          return;
        }
        const basicSalary = Number(row.basicSalary) || 0;
        if (basicSalary > 0) {
          try {
            await addSalaryStructure(result.employee.id, {
              basicSalary,
              currency,
              effectiveFrom: new Date().toISOString().slice(0, 10),
            });
          } catch {
            // Employee itself was created successfully; a salary-structure
            // failure shouldn't undo that — it can be added later from the
            // Employees page. Still mark saved since the row's primary
            // purpose (adding the employee) succeeded.
          }
        }
        updateDraft(row.key, {
          status: 'saved',
          employeeId: result.employee.id,
        });
      }),
    );
  }

  async function handleCsvUpload(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;
    const [header, ...rows] = lines;
    const columns = header!.split(',').map((c) => c.trim().toLowerCase());
    const idx = (name: string) => columns.indexOf(name);
    const fi = idx('firstname'),
      li = idx('lastname'),
      ei = idx('email'),
      si = idx('basicsalary');
    if (fi === -1 || li === -1 || ei === -1) {
      toast.error(
        'CSV must have firstName, lastName, email columns (basicSalary optional)',
      );
      return;
    }
    const parsed: DraftEmployee[] = rows.map((line) => {
      const cells = line.split(',');
      return {
        key: crypto.randomUUID(),
        firstName: cells[fi]?.trim() ?? '',
        lastName: cells[li]?.trim() ?? '',
        email: cells[ei]?.trim() ?? '',
        basicSalary: si !== -1 ? (cells[si]?.trim() ?? '') : '',
        status: 'pending',
      };
    });
    setDrafts((current) => [
      ...current.filter((r) => r.firstName || r.lastName || r.email),
      ...parsed,
    ]);
    toast.success(
      `Loaded ${parsed.length} row(s) from CSV — review, then save`,
    );
  }

  const savedEmployees = drafts.filter((d) => d.status === 'saved');

  // Preview: run each saved employee's basic salary through the exact same
  // engine real payroll uses (packages/payroll-rules, via the public
  // payroll-calculate endpoint) so this is a real projection, not a mock
  // number.
  const previewQuery = useQuery({
    queryKey: [
      'onboarding-preview',
      tenant?.countryCode,
      savedEmployees.map((e) => e.basicSalary).join(','),
    ],
    queryFn: async () => {
      const results = await Promise.all(
        savedEmployees
          .filter((e) => Number(e.basicSalary) > 0)
          .map((e) =>
            calculatePayroll({
              country: tenant!.countryCode,
              salary: Number(e.basicSalary),
            }),
          ),
      );
      return {
        employeeCount: savedEmployees.length,
        grossPay: results.reduce((sum, r) => sum + r.grossPay, 0),
        netPay: results.reduce((sum, r) => sum + r.netPay, 0),
        deductions: results.reduce((sum, r) => sum + r.totalDeductions, 0),
      };
    },
    enabled: step === 4 && !!tenant,
  });

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-bold">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          <button
            type="button"
            className="text-muted-foreground underline"
            onClick={finishOnboarding}
          >
            Skip for now
          </button>
        </div>
        <Progress value={progressPct} />
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`text-xs ${i <= step ? 'text-primary font-bold' : 'text-muted-foreground'}`}
            >
              {i < step ? <Check className="inline h-3 w-3 mr-1" /> : null}
              {s}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Set up your company</CardTitle>
            <CardDescription>
              {tenant
                ? `Payroll will run in ${getCountryName(tenant.countryCode)} (${tenant.defaultCurrency}).`
                : 'Loading your workspace…'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {company ? (
              <div className="rounded-md border-2 border-border bg-primary/5 p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold">{company.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Currency: {company.currency}
                  </p>
                </div>
                <Button onClick={() => setStep(1)}>Continue</Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Logistics Ltd"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    !companyName.trim() || createCompanyMutation.isPending
                  }
                  onClick={() => createCompanyMutation.mutate()}
                >
                  {createCompanyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Create company
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Your payroll rules</CardTitle>
            <CardDescription>
              Statutory deductions are applied automatically based on your
              country and can&apos;t be changed — they&apos;re set by law, not
              by you. The next step lets you add your own custom pay components
              on top of these.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ruleSummary ? (
              <div className="rounded-md border-2 border-border p-4">
                <p className="font-bold mb-2">{ruleSummary.label}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {ruleSummary.lines.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            <Button className="w-full" onClick={() => setStep(2)}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Add your own pay components</h2>
            <p className="text-sm text-muted-foreground">
              Optional. Add allowances or deductions your business pays on top
              of statutory ones — transport, housing, union dues, whatever
              applies to you. You can also add these later from Settings.
            </p>
          </div>
          <SalaryComponentsSettings />
          <Button className="w-full" onClick={() => setStep(3)}>
            Continue
          </Button>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Add your first employees</CardTitle>
            <CardDescription>
              Add a few manually, or upload a CSV (firstName, lastName, email,
              basicSalary). You can add more later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md p-4 text-sm text-muted-foreground cursor-pointer hover:border-primary">
              <Upload className="h-4 w-4" />
              Upload CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCsvUpload(file);
                  e.target.value = '';
                }}
              />
            </label>

            <div className="space-y-3">
              {drafts.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_1fr_1.4fr_0.8fr_auto] gap-2 items-center"
                >
                  <Input
                    placeholder="First name"
                    value={row.firstName}
                    onChange={(e) =>
                      updateDraft(row.key, { firstName: e.target.value })
                    }
                    disabled={row.status === 'saved'}
                  />
                  <Input
                    placeholder="Last name"
                    value={row.lastName}
                    onChange={(e) =>
                      updateDraft(row.key, { lastName: e.target.value })
                    }
                    disabled={row.status === 'saved'}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={row.email}
                    onChange={(e) =>
                      updateDraft(row.key, { email: e.target.value })
                    }
                    disabled={row.status === 'saved'}
                  />
                  <Input
                    placeholder="Basic salary"
                    type="number"
                    min="0"
                    value={row.basicSalary}
                    onChange={(e) =>
                      updateDraft(row.key, { basicSalary: e.target.value })
                    }
                    disabled={row.status === 'saved'}
                  />
                  {row.status === 'saved' ? (
                    <Badge className="justify-center bg-green-600 text-white">
                      <Check className="h-3 w-3" />
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeDraft(row.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {row.status === 'error' && (
                    <p className="col-span-5 text-xs text-red-600 dark:text-red-400">
                      {row.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDrafts((r) => [...r, newDraft()])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add another row
            </Button>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={saveAllDrafts}
                disabled={drafts.every((d) => d.status === 'saved')}
              >
                <Users className="h-4 w-4 mr-2" />
                Save employees
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep(4)}
                disabled={savedEmployees.length === 0}
              >
                Continue ({savedEmployees.length} saved)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview payroll</CardTitle>
            <CardDescription>
              Estimated using the same rules engine that runs real payroll.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Calculating…</p>
            ) : previewQuery.data ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-md border-2 border-border p-4 text-center">
                  <p className="text-2xl font-extrabold">
                    {previewQuery.data.employeeCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Employees</p>
                </div>
                <div className="rounded-md border-2 border-border p-4 text-center">
                  <p className="text-2xl font-extrabold">
                    {formatPrice(previewQuery.data.grossPay, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Est. gross pay
                  </p>
                </div>
                <div className="rounded-md border-2 border-primary bg-primary/10 p-4 text-center">
                  <p className="text-2xl font-extrabold text-primary">
                    {formatPrice(previewQuery.data.netPay, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">Est. net pay</p>
                </div>
              </div>
            ) : null}
            <Button className="w-full" onClick={() => setStep(5)}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a plan</CardTitle>
            <CardDescription>
              Billed per active employee. You can change this anytime in
              Settings → Billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plansQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading plans…</p>
            ) : (
              <div className="grid gap-3">
                {(plansQuery.data ?? []).map((plan: Plan) => (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setSelectedPlanCode(plan.code)}
                    className={`text-left rounded-md border-2 p-4 transition-colors ${
                      selectedPlanCode === plan.code
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{plan.name}</span>
                      <span className="font-extrabold">
                        {formatPrice(plan.pricePerEmployee, plan.currency)} /
                        employee
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={finishOnboarding}
              >
                Decide later
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedPlanCode || subscribeMutation.isPending}
                onClick={() =>
                  selectedPlanCode && subscribeMutation.mutate(selectedPlanCode)
                }
              >
                {subscribeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Activate & go to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
