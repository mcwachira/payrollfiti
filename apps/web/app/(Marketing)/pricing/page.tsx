'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Calculator, Plus, Trash2, FileDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

import {
  listSupportedCountries,
  calculatePayroll,
  downloadPayrollEstimatePdf,
} from '@/lib/payroll-calculator-api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiError } from '@/lib/api-client';
import { getCountryName } from '@/lib/countries';
import { getPricingForCountry } from "@/lib/pricing/catalog"
import { formatPrice } from "@/lib/pricing/format"
interface AmountRow{
  id:string;
  label:string;
  amount:string;
}

function newRow():AmountRow{
  return {
    id:crypto.randomUUID(),
    label:'',
    amount:'',
  }
}

function rowsToRecord(rows:AmountRow[]):Record<string,  number> | undefined {
  const entries = rows.filter((r) => r.label.trim() &&  Number(r.amount) > 0).map((r) => [r.label.trim(), Number(r.amount)] as const);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function formatMoney(amount:number, currency:string){
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
     minimumFractionDigits:0,
    maximumFractionDigits:0,
  }).format(amount);
}

const DEDUCTION_TOOLTIPS: Record<string, string> = {
  NSSF: 'National Social Security Fund — mandatory retirement savings contribution (Tier I & II).',
  SHIF: 'Social Health Insurance Fund — replaced NHIF on 1 October 2024; 2.75% of gross pay, KES 300 minimum.',
  NHIF: 'National Hospital Insurance Fund — mandatory health insurance contribution (superseded by SHIF from October 2024).',
  HOUSING_LEVY:
    'Affordable Housing Levy — 1.5% of gross pay, per the Finance Act 2023.',
  PENSION: 'Mandatory employee pension contribution.',
  NHF: 'National Housing Fund — 2.5% of basic salary, employee-funded.',
  UIF: 'Unemployment Insurance Fund — mandatory contribution covering unemployment benefits.',
  SDL: 'Skills Development Levy — 1% of payroll, paid entirely by the employer.',
};

function AmountRowEditor({
  title,
  rows,
  onChange,
  addLabel
                         }:{
  title: string;
  rows: AmountRow[];
  onChange: (rows: AmountRow[]) => void;
  addLabel: string;
}){
  const updateRow = (id: string, patch: Partial<AmountRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));

  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      {rows.map((row) => (
        <div key={row.id} className="flex gap-2">
          <Input
            placeholder="Label (e.g. Transport)"
            value={row.label}
            onChange={(e) => updateRow(row.id, { label: e.target.value })}
            className="flex-1"
          />
          <Input
            type="number"
            min="0"
            placeholder="Amount"
            value={row.amount}
            onChange={(e) => updateRow(row.id, { amount: e.target.value })}
            className="w-32"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => removeRow(row.id)}
            aria-label={`Remove ${row.label || 'row'}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, newRow()])}
      >
        <Plus className="h-4 w-4 mr-2" />
        {addLabel}
      </Button>
    </div>
  );

}
export default function PricingPage(){
  const [country, setCountry] = useState('KE');
  const [salary, setSalary] = useState('80000');
  const [allowanceRows, setAllowanceRows] = useState<AmountRow[]>([]);
  const [deductionRows, setDeductionRows] = useState<AmountRow[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const countriesQuery = useQuery({
    queryKey:['calculator-countries'],
    queryFn:listSupportedCountries,
    staleTime:Infinity
  })

  const debouncedSalary = useDebouncedValue(salary, 400);
  const debouncedAllowanceRows = useDebouncedValue(allowanceRows, 500);
  const debouncedDeductionRows = useDebouncedValue(deductionRows, 500);

  const salaryValue = Number(debouncedSalary) || 0;
  const allowances = useMemo(() => rowsToRecord(debouncedAllowanceRows) ,[debouncedAllowanceRows])
  const deductions = useMemo(() => rowsToRecord(debouncedDeductionRows) ,[debouncedDeductionRows])


  const calculationQuery = useQuery({
    queryKey: [
      'payroll-calculate',
      country,
      salaryValue,
      allowances,
      deductions,
    ],
    queryFn: () =>
      calculatePayroll({
        country,
        salary: salaryValue,
        allowances,
        deductions,
      }),
    enabled: salaryValue > 0,
  });


  const pricing = getPricingForCountry(country);
  const result = calculationQuery.data;

  const handleExportPdf = async () => {
    if (salaryValue <= 0) return;
    setIsExportingPdf(true);
    try {
      await downloadPayrollEstimatePdf({
        country,
        salary: salaryValue,
        allowances,
        deductions,
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Failed to download PDF',
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCsv = () => {
    if (!result) return;
    const lines: string[] = ['Item,Amount'];
    lines.push(`Basic Salary,${result.earnings.basicSalary}`);
    for (const [label, amount] of Object.entries(
      result.earnings.allowanceBreakdown,
    )) {
      lines.push(`${label},${amount}`);
    }
    lines.push(`Gross Pay,${result.grossPay}`);
    for (const deduction of result.statutoryDeductions) {
      lines.push(`${deduction.label},-${deduction.employeeAmount}`);
    }
    lines.push(`PAYE Tax,-${result.tax.netTax}`);
    lines.push(`Net Pay,${result.netPay}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-estimate-${country}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Choose the plan that fits your team. No setup fees, cancel anytime.
          </p>

          <div className="inline-flex items-center gap-2">
            <Label htmlFor="country-select" className="sr-only">
              Country
            </Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country-select" className="w-48">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {(countriesQuery.data ?? []).map((c) => (
                  <SelectItem key={c.countryCode} value={c.countryCode}>
                    {getCountryName(c.countryCode)} ({c.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-24 items-start">
          {pricing.tiers.map((tier) => (
            <Card
              key={tier.code}
              className={
                tier.highlighted ? 'bg-secondary-background text-primary-foreground' : ''
              }
            >
              <CardHeader>
                {tier.highlighted && (
                  <Badge className="w-fit mb-2 bg-main text-primary">
                    Most Popular
                  </Badge>
                )}
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-extrabold">
                    {formatPrice(tier.price, pricing.currency)}
                  </span>
                  {tier.price !== null && (
                    <span
                      className={
                        tier.highlighted
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      }
                    >
                      /month
                    </span>
                  )}
                </div>
                <p
                  className={
                    tier.highlighted
                      ? 'text-primary-foreground/90 text-sm mt-2'
                      : 'text-muted-foreground text-sm mt-2'
                  }
                >
                  {tier.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="h-4 w-4 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={
                    tier.highlighted
                      ? 'w-full'
                      : 'w-full'
                  }
                  variant={tier.highlighted ? undefined : 'neutral'}
                >
                  <Link
                    href={tier.code === 'enterprise' ? '/contact' : '/signup'}
                  >
                    {tier.code === 'enterprise'
                      ? 'Talk to Sales'
                      : 'Get Started'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payroll Calculator */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Calculator className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-extrabold text-foreground">
                Payroll Calculator
              </h2>
            </div>
            <p className="text-muted-foreground">
              Live PAYE and statutory deduction estimate for{' '}
              {getCountryName(country)}, computed by the same rules engine that
              runs real payroll.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-start">
            <Card>
              <CardHeader>
                <CardTitle>Inputs</CardTitle>
                <CardDescription>
                  Figures are monthly, in {pricing.currency}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="salary">Basic Salary</Label>
                  <Input
                    id="salary"
                    type="number"
                    min="0"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                  />
                </div>

                <AmountRowEditor
                  title="Allowances"
                  rows={allowanceRows}
                  onChange={setAllowanceRows}
                  addLabel="Add Allowance"
                />

                <AmountRowEditor
                  title="Other Deductions (voluntary)"
                  rows={deductionRows}
                  onChange={setDeductionRows}
                  addLabel="Add Deduction"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Breakdown</CardTitle>
                <CardDescription>
                  Updates automatically as you type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {salaryValue <= 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    Enter a basic salary to see the breakdown.
                  </p>
                ) : calculationQuery.isPending ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-5 w-full" />
                    ))}
                  </div>
                ) : calculationQuery.isError ? (
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {calculationQuery.error instanceof ApiError
                      ? calculationQuery.error.message
                      : 'Failed to calculate. Please try again.'}
                  </p>
                ) : result ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <div className="font-bold text-muted-foreground mb-1">
                        Earnings
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Basic Salary</span>
                        <span>
                          {formatMoney(
                            result.earnings.basicSalary,
                            result.currency,
                          )}
                        </span>
                      </div>
                      {Object.entries(result.earnings.allowanceBreakdown).map(
                        ([label, amount]) => (
                          <div
                            key={label}
                            className="flex justify-between py-1"
                          >
                            <span>{label}</span>
                            <span>{formatMoney(amount, result.currency)}</span>
                          </div>
                        ),
                      )}
                      <div className="flex justify-between py-1 font-bold border-t-2 border-border mt-1 pt-2">
                        <span>Gross Pay</span>
                        <span>
                          {formatMoney(result.grossPay, result.currency)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-muted-foreground mb-1">
                        Statutory Deductions
                      </div>
                      {result.statutoryDeductions.map((deduction) => (
                        <div
                          key={deduction.code}
                          className="flex justify-between py-1"
                        >
                          <span className="flex items-center gap-1">
                            {deduction.label}
                            {DEDUCTION_TOOLTIPS[deduction.code] && (
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label={`About ${deduction.label}`}
                                >
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {DEDUCTION_TOOLTIPS[deduction.code]}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                          {deduction.employeeAmount > 0 ? (
                            <span className="text-red-600 dark:text-red-400">
                              -
                              {formatMoney(
                                deduction.employeeAmount,
                                result.currency,
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">
                              Employer-paid
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="font-bold text-muted-foreground mb-1 flex items-center gap-1">
                        Tax (PAYE)
                        <Tooltip>
                          <TooltipTrigger type="button" aria-label="About PAYE">
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Pay As You Earn — progressive income tax calculated
                            on taxable income after statutory deductions and
                            relief.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Taxable Income</span>
                        <span>
                          {formatMoney(
                            result.tax.taxableIncome,
                            result.currency,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Gross Tax</span>
                        <span>
                          {formatMoney(result.tax.grossTax, result.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Relief</span>
                        <span>
                          -{formatMoney(result.tax.relief, result.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 font-bold border-t-2 border-border mt-1 pt-2">
                        <span>Net Tax</span>
                        <span>
                          {formatMoney(result.tax.netTax, result.currency)}
                        </span>
                      </div>
                    </div>

                    {result.validation.length > 0 && (
                      <div className="rounded-md border-2 border-border bg-yellow-50 dark:bg-yellow-950/30 p-3 space-y-1">
                        {result.validation.map((issue) => (
                          <p key={issue.field} className="text-xs">
                            {issue.message}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="rounded-md border-2 border-border bg-primary/10 p-4 flex justify-between items-center">
                      <span className="font-extrabold">Net Pay</span>
                      <span className="text-xl font-extrabold text-primary">
                        {formatMoney(result.netPay, result.currency)}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={handleExportCsv}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        CSV
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={handleExportPdf}
                        disabled={isExportingPdf}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        {isExportingPdf ? 'Generating…' : 'PDF'}
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Illustrative estimate only — actual payroll runs may
                      include additional company-specific salary structures.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
