'use client';
import { useMemo, useState } from 'react';

import Link from 'next/link';

import { useQuery } from '@tanstack/react-query';

import { toast } from 'sonner';

import {
  Check,
  Calculator,
  Plus,
  Trash2,
  FileDown,
  Info,
} from 'lucide-react';

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

// Custom hook used to delay API-triggering values
// until the user stops typing for a short period.
import { useDebouncedValue } from '@/hooks/use-debounced-value';

// Custom API error class.
import { ApiError } from '@/lib/api-client';

// Converts country codes like KE into readable names.
import { getCountryName } from '@/lib/countries';

// Returns pricing configuration for a selected country.
import { getPricingForCountry } from '@/lib/pricing/catalog';

// Formats subscription prices.
import { formatPrice } from '@/lib/pricing/format';


// ---------------------------------------------------------
// AMOUNT ROW TYPE
// ---------------------------------------------------------

// Represents one editable allowance or deduction row.
//
// Example:
//
// {
//   id: "123",
//   label: "Transport",
//   amount: "5000"
// }
interface AmountRow {
  id: string;
  label: string;
  amount: string;
}


// ---------------------------------------------------------
// CREATE NEW ROW
// ---------------------------------------------------------

// Creates an empty allowance/deduction row.
//
// crypto.randomUUID() gives each row a unique ID so React
// can track it correctly when rendering a list.
function newRow(): AmountRow {
  return {
    id: crypto.randomUUID(),
    label: '',
    amount: '',
  };
}


// ---------------------------------------------------------
// CONVERT ROWS INTO API FORMAT
// ---------------------------------------------------------

// Converts rows like:
//
// [
//   { label: "Transport", amount: "5000" },
//   { label: "Housing", amount: "10000" }
// ]
//
// into:
//
// {
//   Transport: 5000,
//   Housing: 10000
// }
//
// Invalid or empty rows are ignored.
function rowsToRecord(
  rows: AmountRow[],
): Record<string, number> | undefined {

  const entries = rows

    // Keep rows that:
    // - Have a non-empty label.
    // - Have an amount greater than zero.
    .filter(
      (row) =>
        row.label.trim() &&
        Number(row.amount) > 0,
    )

    // Convert each row into a key/value pair.
    //
    // Example:
    //
    // ["Transport", 5000]
    .map(
      (row) =>
        [
          row.label.trim(),
          Number(row.amount),
        ] as const,
    );


  // Convert the array of entries into an object.
  //
  // If there are no valid rows, return undefined instead.
  return entries.length > 0
    ? Object.fromEntries(entries)
    : undefined;
}


// ---------------------------------------------------------
// FORMAT MONEY
// ---------------------------------------------------------

// Formats a number using the supplied currency.
//
// Example:
//
// formatMoney(80000, 'KES')
//
// might display:
//
// KES 80,000
function formatMoney(
  amount: number,
  currency: string,
) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,

    // Payroll figures are displayed without decimal places.
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}


// ---------------------------------------------------------
// DEDUCTION TOOLTIP DESCRIPTIONS
// ---------------------------------------------------------

// Human-readable descriptions for statutory deductions.
//
// The API returns deduction codes such as:
//
// NSSF
// SHIF
// HOUSING_LEVY
//
// We use the code to look up explanatory text.
const DEDUCTION_TOOLTIPS: Record<string, string> = {
  NSSF:
    'National Social Security Fund — mandatory retirement savings contribution (Tier I & II).',

  SHIF:
    'Social Health Insurance Fund — replaced NHIF on 1 October 2024; 2.75% of gross pay, KES 300 minimum.',

  NHIF:
    'National Hospital Insurance Fund — mandatory health insurance contribution (superseded by SHIF from October 2024).',

  HOUSING_LEVY:
    'Affordable Housing Levy — 1.5% of gross pay, per the Finance Act 2023.',

  PENSION:
    'Mandatory employee pension contribution.',

  NHF:
    'National Housing Fund — 2.5% of basic salary, employee-funded.',

  UIF:
    'Unemployment Insurance Fund — mandatory contribution covering unemployment benefits.',

  SDL:
    'Skills Development Levy — 1% of payroll, paid entirely by the employer.',
};


// ---------------------------------------------------------
// AMOUNT ROW EDITOR
// ---------------------------------------------------------

// Reusable component for editing:
//
// - Allowances
// - Voluntary deductions
//
// It renders:
// - Label input.
// - Amount input.
// - Delete button.
// - Add button.
function AmountRowEditor({
  title,
  rows,
  onChange,
  addLabel,
}: {
  title: string;
  rows: AmountRow[];

  // Parent component controls the rows.
  // This function sends updated rows back to the parent.
  onChange: (rows: AmountRow[]) => void;

  // Text shown in the add button.
  addLabel: string;
}) {

  // Updates a specific row.
  //
  // `patch` may contain only the field that changed.
  //
  // Example:
  //
  // updateRow(id, { amount: "5000" })
  const updateRow = (
    id: string,
    patch: Partial<AmountRow>,
  ) => {
    onChange(
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  };


  // Removes a row by its ID.
  const removeRow = (id: string) => {
    onChange(
      rows.filter((row) => row.id !== id),
    );
  };


  return (
    <div className="space-y-2">

      {/* Section title */}
      <Label>{title}</Label>


      {/* Render each allowance/deduction row */}
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex gap-2"
        >

          {/* Allowance/deduction name */}
          <Input
            placeholder="Label (e.g. Transport)"
            value={row.label}
            onChange={(event) =>
              updateRow(row.id, {
                label: event.target.value,
              })
            }
            className="flex-1"
          />


          {/* Allowance/deduction amount */}
          <Input
            type="number"
            min="0"
            placeholder="Amount"
            value={row.amount}
            onChange={(event) =>
              updateRow(row.id, {
                amount: event.target.value,
              })
            }
            className="w-32"
          />


          {/* Remove the current row */}
          <Button
            type="button"
            variant="neutral"
            size="icon"
            onClick={() => removeRow(row.id)}
            aria-label={`Remove ${row.label || 'row'}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}


      {/* Add a new empty row */}
      <Button
        type="button"
        variant="neutral"
        size="sm"
        onClick={() =>
          onChange([
            ...rows,
            newRow(),
          ])
        }
      >
        <Plus className="h-4 w-4 mr-2" />
        {addLabel}
      </Button>

    </div>
  );
}


// ---------------------------------------------------------
// PRICING PAGE
// ---------------------------------------------------------

export default function PricingPage() {

  // Selected country.
  //
  // KE is the initial/default country.
  const [country, setCountry] =
    useState('KE');


  // Salary is stored as a string because it comes directly
  // from an HTML input.
  //
  // We convert it into a number later.
  const [salary, setSalary] =
    useState('80000');


  // Dynamic allowance rows entered by the user.
  const [
    allowanceRows,
    setAllowanceRows,
  ] = useState<AmountRow[]>([]);


  // Dynamic voluntary deduction rows.
  const [
    deductionRows,
    setDeductionRows,
  ] = useState<AmountRow[]>([]);


  // Controls the PDF button loading state.
  const [
    isExportingPdf,
    setIsExportingPdf,
  ] = useState(false);


  // -------------------------------------------------------
  // LOAD SUPPORTED COUNTRIES
  // -------------------------------------------------------

  // Fetch the list of countries supported by
  // the payroll calculator.
  const countriesQuery = useQuery({
    queryKey: ['calculator-countries'],

    // Function that actually calls the API.
    queryFn: listSupportedCountries,

    // Supported countries rarely change during a session,
    // so keep them fresh forever.
    staleTime: Infinity,
  });


  // -------------------------------------------------------
  // DEBOUNCE USER INPUT
  // -------------------------------------------------------

  // Wait 400ms after the user stops typing salary
  // before changing debouncedSalary.
  //
  // This prevents calling the payroll API on every keypress.
  const debouncedSalary =
    useDebouncedValue(salary, 400);


  // Wait 500ms after changes to allowances.
  const debouncedAllowanceRows =
    useDebouncedValue(allowanceRows, 500);


  // Wait 500ms after changes to voluntary deductions.
  const debouncedDeductionRows =
    useDebouncedValue(deductionRows, 500);


  // Convert the debounced salary string to a number.
  //
  // If conversion fails, use 0.
  const salaryValue =
    Number(debouncedSalary) || 0;


  // -------------------------------------------------------
  // CONVERT ROWS TO API OBJECTS
  // -------------------------------------------------------

  // Convert allowance rows into:
  //
  // {
  //   Transport: 5000,
  //   Housing: 10000
  // }
  //
  // useMemo prevents recalculation unless the
  // debounced rows change.
  const allowances = useMemo(
    () =>
      rowsToRecord(debouncedAllowanceRows),
    [debouncedAllowanceRows],
  );


  // Do the same for voluntary deductions.
  const deductions = useMemo(
    () =>
      rowsToRecord(debouncedDeductionRows),
    [debouncedDeductionRows],
  );


  // -------------------------------------------------------
  // CALCULATE PAYROLL
  // -------------------------------------------------------

  const calculationQuery = useQuery({

    // The query key identifies this calculation in
    // React Query's cache.
    //
    // If any value changes, React Query treats it as
    // a different calculation and fetches new data.
    queryKey: [
      'payroll-calculate',
      country,
      salaryValue,
      allowances,
      deductions,
    ],


    // Function that calls the payroll calculator API.
    queryFn: () =>
      calculatePayroll({
        country,
        salary: salaryValue,
        allowances,
        deductions,
      }),


    // Don't call the calculator API if salary is
    // zero or invalid.
    enabled: salaryValue > 0,
  });


  // -------------------------------------------------------
  // PRICING
  // -------------------------------------------------------

  // Get subscription prices for the selected country.
  const pricing =
    getPricingForCountry(country);


  // Shortcut to the payroll calculation result.
  const result =
    calculationQuery.data;


  // -------------------------------------------------------
  // EXPORT PDF
  // -------------------------------------------------------

  const handleExportPdf = async () => {

    // Don't generate a PDF without a valid salary.
    if (salaryValue <= 0) return;


    // Disable the PDF button while generating.
    setIsExportingPdf(true);


    try {

      // Ask the backend to generate and download
      // the payroll estimate PDF.
      await downloadPayrollEstimatePdf({
        country,
        salary: salaryValue,
        allowances,
        deductions,
      });

    } catch (error) {

      // Show the API error message if available.
      //
      // Otherwise use a generic message.
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Failed to download PDF',
      );

    } finally {

      // Re-enable the button regardless of whether
      // the request succeeded or failed.
      setIsExportingPdf(false);
    }
  };


  // -------------------------------------------------------
  // EXPORT CSV
  // -------------------------------------------------------

  const handleExportCsv = () => {

    // Can't generate a CSV without a calculation result.
    if (!result) return;


    // Each element becomes one CSV line.
    const lines: string[] = [
      'Item,Amount',
    ];


    // Add basic salary.
    lines.push(
      `Basic Salary,${result.earnings.basicSalary}`,
    );


    // Add all allowances.
    for (
      const [label, amount]
      of Object.entries(
        result.earnings.allowanceBreakdown,
      )
    ) {
      lines.push(
        `${label},${amount}`,
      );
    }


    // Add gross pay.
    lines.push(
      `Gross Pay,${result.grossPay}`,
    );


    // Add statutory deductions.
    for (
      const deduction
      of result.statutoryDeductions
    ) {
      lines.push(
        `${deduction.label},-${deduction.employeeAmount}`,
      );
    }


    // Add PAYE tax.
    lines.push(
      `PAYE Tax,-${result.tax.netTax}`,
    );


    // Add final net pay.
    lines.push(
      `Net Pay,${result.netPay}`,
    );


    // Convert the CSV text into a Blob.
    const blob = new Blob(
      [lines.join('\n')],
      {
        type: 'text/csv',
      },
    );


    // Create a temporary browser URL.
    const url =
      URL.createObjectURL(blob);


    // Create an invisible link used
    // to trigger the file download.
    const link =
      document.createElement('a');


    // Point the link to our CSV Blob.
    link.href = url;


    // Example:
    //
    // payroll-estimate-KE.csv
    link.download =
      `payroll-estimate-${country}.csv`;


    // Add the link to the DOM.
    document.body.appendChild(link);


    // Trigger the browser download.
    link.click();


    // Remove the temporary element.
    link.remove();


    // Release the temporary Blob URL.
    URL.revokeObjectURL(url);
  };


  // -------------------------------------------------------
  // PAGE UI
  // -------------------------------------------------------

  return (
    <div className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">


        {/* -----------------------------------------------
            PRICING HEADER
        ------------------------------------------------ */}

        <div className="text-center mb-10">

          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Choose the plan that fits your team.
            No setup fees, cancel anytime.
          </p>


          {/* Country selector */}
          <div className="inline-flex items-center gap-2">

            {/* Hidden label for accessibility */}
            <Label
              htmlFor="country-select"
              className="sr-only"
            >
              Country
            </Label>


            {/* Update pricing and payroll rules when
                the selected country changes */}
            <Select
              value={country}
              onValueChange={setCountry}
            >

              <SelectTrigger
                id="country-select"
                className="w-48"
              >
                <SelectValue placeholder="Select country" />
              </SelectTrigger>


              <SelectContent>

                {/* Display all supported payroll countries */}
                {(countriesQuery.data ?? []).map(
                  (supportedCountry) => (
                    <SelectItem
                      key={
                        supportedCountry.countryCode
                      }
                      value={
                        supportedCountry.countryCode
                      }
                    >
                      {getCountryName(
                        supportedCountry.countryCode,
                      )}{' '}
                      ({supportedCountry.currency})
                    </SelectItem>
                  ),
                )}

              </SelectContent>

            </Select>

          </div>

        </div>


        {/* -----------------------------------------------
            PRICING TIERS
        ------------------------------------------------ */}

        <div className="grid md:grid-cols-3 gap-8 mb-24 items-start">

          {/* Render one pricing card per plan */}
          {pricing.tiers.map((tier) => (

            <Card
              key={tier.code}
              className={
                tier.highlighted
                  ? 'bg-secondary-background text-primary-foreground'
                  : ''
              }
            >

              <CardHeader>

                {/* Highlight recommended plan */}
                {tier.highlighted && (
                  <Badge className="w-fit mb-2 bg-main text-primary">
                    Most Popular
                  </Badge>
                )}


                {/* Plan name */}
                <CardTitle className="text-2xl">
                  {tier.name}
                </CardTitle>


                {/* Plan price */}
                <div className="flex items-baseline gap-1 mt-2">

                  <span className="text-3xl font-extrabold">
                    {formatPrice(
                      tier.price,
                      pricing.currency,
                    )}
                  </span>


                  {/* Enterprise plans may not have
                      a fixed monthly price */}
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


                {/* Plan description */}
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

                {/* Plan features */}
                <ul className="space-y-3">

                  {tier.features.map(
                    (feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="h-4 w-4 mt-0.5 shrink-0" />

                        {feature}
                      </li>
                    ),
                  )}

                </ul>


                {/* Pricing CTA */}
                <Button
                  asChild
                  className="w-full"
                  variant={
                    tier.highlighted
                      ? undefined
                      : 'neutral'
                  }
                >

                  <Link
                    href={
                      tier.code === 'enterprise'
                        ? '/contact'
                        : '/signup'
                    }
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


        {/* -----------------------------------------------
            PAYROLL CALCULATOR
        ------------------------------------------------ */}

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
              {getCountryName(country)}, computed by the same
              rules engine that runs real payroll.
            </p>

          </div>


          <div className="grid md:grid-cols-2 gap-6 items-start">


            {/* -------------------------------------------
                CALCULATOR INPUTS
            -------------------------------------------- */}

            <Card>

              <CardHeader>

                <CardTitle>
                  Inputs
                </CardTitle>

                <CardDescription>
                  Figures are monthly, in {pricing.currency}.
                </CardDescription>

              </CardHeader>


              <CardContent className="space-y-6">


                {/* Salary input */}
                <div className="space-y-2">

                  <Label htmlFor="salary">
                    Basic Salary
                  </Label>

                  <Input
                    id="salary"
                    type="number"
                    min="0"
                    value={salary}

                    // Update salary immediately as user types.
                    //
                    // The API request uses debouncedSalary,
                    // so it will not run on every keystroke.
                    onChange={(event) =>
                      setSalary(
                        event.target.value,
                      )
                    }
                  />

                </div>


                {/* Allowance editor */}
                <AmountRowEditor
                  title="Allowances"
                  rows={allowanceRows}
                  onChange={setAllowanceRows}
                  addLabel="Add Allowance"
                />


                {/* Voluntary deduction editor */}
                <AmountRowEditor
                  title="Other Deductions (voluntary)"
                  rows={deductionRows}
                  onChange={setDeductionRows}
                  addLabel="Add Deduction"
                />

              </CardContent>

            </Card>


            {/* -------------------------------------------
                PAYROLL RESULT
            -------------------------------------------- */}

            <Card>

              <CardHeader>

                <CardTitle>
                  Breakdown
                </CardTitle>

                <CardDescription>
                  Updates automatically as you type.
                </CardDescription>

              </CardHeader>


              <CardContent>

                {/* No valid salary yet */}
                {salaryValue <= 0 ? (

                  <p className="text-muted-foreground text-sm py-8 text-center">
                    Enter a basic salary to see the breakdown.
                  </p>


                // Payroll calculation is loading.
                ) : calculationQuery.isPending ? (

                  <div className="space-y-3">

                    {/* Show loading placeholders */}
                    {Array.from({
                      length: 6,
                    }).map((_, index) => (

                      <Skeleton
                        key={index}
                        className="h-5 w-full"
                      />

                    ))}

                  </div>


                // Payroll API failed.
                ) : calculationQuery.isError ? (

                  <p className="text-red-600 dark:text-red-400 text-sm">

                    {calculationQuery.error instanceof ApiError
                      ? calculationQuery.error.message
                      : 'Failed to calculate. Please try again.'}

                  </p>


                // Payroll result is available.
                ) : result ? (

                  <div className="space-y-4 text-sm">


                    {/* -----------------------------------
                        EARNINGS
                    ------------------------------------ */}

                    <div>

                      <div className="font-bold text-muted-foreground mb-1">
                        Earnings
                      </div>


                      {/* Basic salary */}
                      <div className="flex justify-between py-1">

                        <span>
                          Basic Salary
                        </span>

                        <span>
                          {formatMoney(
                            result.earnings.basicSalary,
                            result.currency,
                          )}
                        </span>

                      </div>


                      {/* Allowance breakdown */}
                      {Object.entries(
                        result.earnings.allowanceBreakdown,
                      ).map(
                        ([label, amount]) => (

                          <div
                            key={label}
                            className="flex justify-between py-1"
                          >

                            <span>
                              {label}
                            </span>

                            <span>
                              {formatMoney(
                                amount,
                                result.currency,
                              )}
                            </span>

                          </div>

                        ),
                      )}


                      {/* Gross pay */}
                      <div className="flex justify-between py-1 font-bold border-t-2 border-border mt-1 pt-2">

                        <span>
                          Gross Pay
                        </span>

                        <span>
                          {formatMoney(
                            result.grossPay,
                            result.currency,
                          )}
                        </span>

                      </div>

                    </div>


                    {/* -----------------------------------
                        STATUTORY DEDUCTIONS
                    ------------------------------------ */}

                    <div>

                      <div className="font-bold text-muted-foreground mb-1">
                        Statutory Deductions
                      </div>


                      {result.statutoryDeductions.map(
                        (deduction) => (

                          <div
                            key={deduction.code}
                            className="flex justify-between py-1"
                          >

                            {/* Deduction name + help tooltip */}
                            <span className="flex items-center gap-1">

                              {deduction.label}


                              {/* Only display an info tooltip
                                  if we have a description for
                                  this deduction code */}
                              {DEDUCTION_TOOLTIPS[
                                deduction.code
                              ] && (

                                <Tooltip>

                                  <TooltipTrigger
                                    type="button"
                                    aria-label={`About ${deduction.label}`}
                                  >
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                  </TooltipTrigger>


                                  <TooltipContent>
                                    {
                                      DEDUCTION_TOOLTIPS[
                                        deduction.code
                                      ]
                                    }
                                  </TooltipContent>

                                </Tooltip>

                              )}

                            </span>


                            {/* Employee contribution */}
                            {deduction.employeeAmount > 0 ? (

                              <span className="text-red-600 dark:text-red-400">
                                -
                                {formatMoney(
                                  deduction.employeeAmount,
                                  result.currency,
                                )}
                              </span>

                            ) : (

                              // Some deductions may be paid
                              // entirely by the employer.
                              <span className="text-muted-foreground text-xs italic">
                                Employer-paid
                              </span>

                            )}

                          </div>

                        ),
                      )}

                    </div>


                    {/* -----------------------------------
                        PAYE TAX
                    ------------------------------------ */}

                    <div>

                      <div className="font-bold text-muted-foreground mb-1 flex items-center gap-1">

                        Tax (PAYE)


                        {/* Explain PAYE */}
                        <Tooltip>

                          <TooltipTrigger
                            type="button"
                            aria-label="About PAYE"
                          >
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>


                          <TooltipContent>
                            Pay As You Earn — progressive
                            income tax calculated on taxable
                            income after statutory deductions
                            and relief.
                          </TooltipContent>

                        </Tooltip>

                      </div>


                      {/* Taxable income */}
                      <div className="flex justify-between py-1">

                        <span>
                          Taxable Income
                        </span>

                        <span>
                          {formatMoney(
                            result.tax.taxableIncome,
                            result.currency,
                          )}
                        </span>

                      </div>


                      {/* Tax before relief */}
                      <div className="flex justify-between py-1">

                        <span>
                          Gross Tax
                        </span>

                        <span>
                          {formatMoney(
                            result.tax.grossTax,
                            result.currency,
                          )}
                        </span>

                      </div>


                      {/* Tax relief */}
                      <div className="flex justify-between py-1">

                        <span>
                          Relief
                        </span>

                        <span>
                          -
                          {formatMoney(
                            result.tax.relief,
                            result.currency,
                          )}
                        </span>

                      </div>


                      {/* Final PAYE */}
                      <div className="flex justify-between py-1 font-bold border-t-2 border-border mt-1 pt-2">

                        <span>
                          Net Tax
                        </span>

                        <span>
                          {formatMoney(
                            result.tax.netTax,
                            result.currency,
                          )}
                        </span>

                      </div>

                    </div>


                    {/* -----------------------------------
                        VALIDATION WARNINGS
                    ------------------------------------ */}

                    {result.validation.length > 0 && (

                      <div className="rounded-md border-2 border-border bg-yellow-50 dark:bg-yellow-950/30 p-3 space-y-1">

                        {result.validation.map(
                          (issue) => (

                            <p
                              key={issue.field}
                              className="text-xs"
                            >
                              {issue.message}
                            </p>

                          ),
                        )}

                      </div>

                    )}


                    {/* -----------------------------------
                        NET PAY
                    ------------------------------------ */}

                    <div className="rounded-md border-2 border-border bg-primary/10 p-4 flex justify-between items-center">

                      <span className="font-extrabold">
                        Net Pay
                      </span>

                      <span className="text-xl font-extrabold text-primary">
                        {formatMoney(
                          result.netPay,
                          result.currency,
                        )}
                      </span>

                    </div>


                    {/* -----------------------------------
                        EXPORT BUTTONS
                    ------------------------------------ */}

                    <div className="flex gap-2 pt-2">


                      {/* Download CSV */}
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={handleExportCsv}
                      >

                        <FileDown className="h-4 w-4 mr-2" />

                        CSV

                      </Button>


                      {/* Download PDF */}
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={handleExportPdf}

                        // Prevent duplicate PDF requests
                        // while one is already being generated.
                        disabled={isExportingPdf}
                      >

                        <FileDown className="h-4 w-4 mr-2" />

                        {isExportingPdf
                          ? 'Generating…'
                          : 'PDF'}

                      </Button>

                    </div>


                    {/* Calculation disclaimer */}
                    <p className="text-xs text-muted-foreground">
                      Illustrative estimate only — actual
                      payroll runs may include additional
                      company-specific salary structures.
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

