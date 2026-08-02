# Part 3 — The Payroll Calculation Engine

This is the architectural core of the product: `packages/payroll-rules`. It has zero dependency on NestJS, Prisma, or HTTP — every function here is pure, so it can be tested exhaustively and reused anywhere (the real payroll run, the public marketing-site calculator, a future CLI).

## 3.1 Package Layout

```
packages/payroll-rules/src/
├── types.ts          # every shared interface
├── money.ts           # round2/round4/sum/stableStringify
├── proration.ts        # mid-period joiner/leaver math
├── engine.ts           # runPayrollCalculation — the single entrypoint
├── registry.ts          # country + version resolution
├── index.ts             # public exports
└── countries/
    ├── kenya/          # paye.ts nssf.ts nhif.ts shif.ts housingLevy.ts constants.ts index.ts
    ├── nigeria/         # paye.ts pension.ts nhf.ts constants.ts index.ts
    └── south-africa/    # paye.ts uif.ts sdl.ts constants.ts index.ts
```

## 3.2 Core Types

Every country implementation satisfies the same `CountryRuleSet` contract, which is what makes the engine and registry country-agnostic:

```typescript
// types.ts
export interface EarningsInput {
  basicSalary: number;
  allowances?: Record<string, number>;
  overtimeAmount?: number;
  commissionAmount?: number;
  bonusAmount?: number;
}

export interface EmploymentPeriod {
  periodStart: string;   // ISO date
  periodEnd: string;
  employmentStartDate?: string; // set for mid-period joiners
  employmentEndDate?: string;   // set for mid-period leavers
}

export interface PayrollCalculationInput {
  employeeId: string;
  countryCode: string;
  currency: string;
  earnings: EarningsInput;
  deductions?: { voluntary?: Record<string, number> };
  period: EmploymentPeriod;
}

export interface StatutoryDeductionLine {
  code: string;           // "NSSF", "PENSION", "UIF", ...
  label: string;
  employeeAmount: number;
  employerAmount: number;
}

export interface TaxResult {
  code: string;            // "PAYE"
  taxableIncome: number;
  grossTax: number;
  relief: number;
  netTax: number;
}

/**
 * Strategy-pattern contract every country payroll module implements.
 * Implementations must be pure — no I/O, no clock reads, no randomness —
 * so a given (input, ruleset) pair always yields the same result.
 */
export interface CountryRuleSet {
  countryCode: string;
  version: string;         // opaque tag recorded on every payroll run
  effectiveFrom: string;
  currency: string;
  calculateEarnings(input: EarningsInput): EarningsResult;
  calculateStatutoryDeductions(ctx: { grossPay: number; earnings: EarningsResult }): StatutoryDeductionLine[];
  calculateTax(ctx: { grossPay: number; statutoryDeductions: StatutoryDeductionLine[] }): TaxResult;
  validate(input: PayrollCalculationInput): ValidationIssue[];
}
```

## 3.3 Money & Determinism Helpers

Floating point math on money needs disciplined rounding, and idempotency needs a hash that doesn't depend on object key order:

```typescript
// money.ts
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Deterministic JSON serialization — sorts object keys recursively so key order never affects the output */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify((value as any)[key])}`,
  );
  return `{${entries.join(',')}}`;
}
```

Every intermediate monetary value is rounded to 2 decimal places with `round2` immediately after computing it — never accumulated unrounded and rounded once at the end — so a payslip's line items always sum exactly to its displayed totals.

## 3.4 Proration

Mid-period joiners and leavers get their fixed pay elements scaled by the fraction of the period actually worked:

```typescript
// proration.ts
function diffDaysInclusive(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export function calculateProrationFactor(period: EmploymentPeriod): number {
  const periodStart = new Date(period.periodStart);
  const periodEnd = new Date(period.periodEnd);
  const totalDays = diffDaysInclusive(periodStart, periodEnd);
  if (totalDays <= 0) return 0;

  const employmentStart = period.employmentStartDate ? new Date(period.employmentStartDate) : undefined;
  const employmentEnd = period.employmentEndDate ? new Date(period.employmentEndDate) : undefined;

  const effectiveStart = employmentStart && employmentStart > periodStart ? employmentStart : periodStart;
  const effectiveEnd = employmentEnd && employmentEnd < periodEnd ? employmentEnd : periodEnd;
  if (effectiveEnd < effectiveStart) return 0;

  const workedDays = diffDaysInclusive(effectiveStart, effectiveEnd);
  return Math.min(1, Math.max(0, round4(workedDays / totalDays)));
}
```

Overtime, commission, and bonus amounts are deliberately **not** scaled by this factor when applied in `prorateEarnings` — they represent actuals already tied to real days worked or one-off events, not a rate that should be diluted by partial attendance. Only `basicSalary` and `allowances` get scaled.

## 3.5 The Engine Entrypoint

```typescript
// engine.ts
export function computeInputHash(input: PayrollCalculationInput, ruleVersion: string): string {
  return createHash('sha256').update(stableStringify({ input, ruleVersion })).digest('hex');
}

export function runPayrollCalculation(
  input: PayrollCalculationInput,
  ruleSet: CountryRuleSet,
): PayrollCalculationResult {
  const validation = ruleSet.validate(input);
  const prorationFactor = calculateProrationFactor(input.period);

  const fullEarnings = ruleSet.calculateEarnings(input.earnings);
  const earnings = prorateEarnings(fullEarnings, prorationFactor);

  const statutoryDeductions = ruleSet.calculateStatutoryDeductions({
    grossPay: earnings.grossPay,
    earnings,
  });
  const tax = ruleSet.calculateTax({ grossPay: earnings.grossPay, statutoryDeductions });

  const voluntaryDeductions = input.deductions?.voluntary ?? {};
  const totalVoluntaryDeductions = round2(sum(Object.values(voluntaryDeductions)));
  const totalStatutoryEmployeeAmount = sum(statutoryDeductions.map((d) => d.employeeAmount));
  const totalDeductions = round2(totalStatutoryEmployeeAmount + tax.netTax + totalVoluntaryDeductions);
  const netPay = round2(earnings.grossPay - totalDeductions);

  return {
    employeeId: input.employeeId,
    countryCode: ruleSet.countryCode,
    currency: input.currency,
    ruleVersion: ruleSet.version,
    prorationFactor,
    earnings,
    statutoryDeductions,
    voluntaryDeductions,
    totalVoluntaryDeductions,
    tax,
    totalDeductions,
    grossPay: earnings.grossPay,
    netPay,
    validation,
    inputHash: computeInputHash(input, ruleSet.version),
  };
}
```

Notice the order of operations: **proration happens between earnings calculation and everything downstream** — statutory deductions and tax are always computed on the *prorated* gross pay, so a mid-month joiner's NSSF/PAYE/etc. are correctly based on what they actually earned that period, not their full monthly rate.

## 3.6 The Registry — Versioned Rules by Country

```typescript
// registry.ts
const REGISTRY: Record<string, CountryRuleSet[]> = {
  KE: kenyaRuleSets,
  NG: nigeriaRuleSets,
  ZA: southAfricaRuleSets,
};

export class UnsupportedCountryError extends Error { /* ... */ }
export class NoApplicableRuleVersionError extends Error { /* ... */ }

/**
 * Resolves the ruleset that applies for a country on a given date, picking
 * the most recent version whose effectiveFrom is on or before that date.
 * A payroll run always records which version it used, and re-running the
 * same period later reproduces it by pinning effectiveDate to the period
 * rather than "now".
 */
export function getCountryRuleSet(countryCode: string, effectiveDate: Date = new Date()): CountryRuleSet {
  const ruleSets = REGISTRY[countryCode.toUpperCase()];
  if (!ruleSets || ruleSets.length === 0) throw new UnsupportedCountryError(countryCode);

  const applicable = ruleSets
    .filter((rs) => new Date(rs.effectiveFrom).getTime() <= effectiveDate.getTime())
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  const ruleSet = applicable[0];
  if (!ruleSet) throw new NoApplicableRuleVersionError(countryCode, effectiveDate);
  return ruleSet;
}

export function getRuleSetByVersion(countryCode: string, version: string): CountryRuleSet {
  const ruleSet = REGISTRY[countryCode.toUpperCase()]?.find((rs) => rs.version === version);
  if (!ruleSet) throw new UnsupportedCountryError(`${countryCode}@${version}`);
  return ruleSet;
}
```

Adding a fourth country is exactly: write a new `countries/<name>/` module implementing `CountryRuleSet`, add it to `REGISTRY`. Nothing else in the engine, the API, or the frontend calculator needs to change.

## 3.7 Kenya (KE) — Two Versions, One Historical Transition

Kenya is the most complex ruleset because it's the one with a real legislative transition baked in: NHIF was replaced by SHIF (Social Health Insurance Fund) on 1 October 2024.

```typescript
// countries/kenya/constants.ts
export const PAYE_BRACKETS = [
  { min: 0, max: 24_000, rate: 0.10 },
  { min: 24_000, max: 32_333, rate: 0.25 },
  { min: 32_333, max: 500_000, rate: 0.30 },
  { min: 500_000, max: 800_000, rate: 0.325 },
  { min: 800_000, max: Infinity, rate: 0.35 },
];
export const PERSONAL_RELIEF = 2_400;

export const NSSF_TIERS = {
  tier1: { lowerLimit: 0, upperLimit: 7_000, rate: 0.06 },
  tier2: { lowerLimit: 7_000, upperLimit: 36_000, rate: 0.06 },
};

export const NHIF_BANDS = [
  { max: 5_999, amount: 150 }, { max: 7_999, amount: 300 }, /* ... */ { max: Infinity, amount: 1_700 },
];

export const HOUSING_LEVY_RATE = 0.015; // 1.5% employee + 1.5% employer, uncapped

export const KENYA_V1_VERSION = 'KE-2024.1';
export const KENYA_V1_EFFECTIVE_FROM = '2024-01-01';
export const KENYA_V2_VERSION = 'KE-2024.2';
export const KENYA_V2_EFFECTIVE_FROM = '2024-10-01'; // SHIF Act 2023 commencement

export const SHIF_RATE = 0.0275;
export const SHIF_MINIMUM_CONTRIBUTION = 300;
```

PAYE is a standard graduated-bracket walk:

```typescript
// countries/kenya/paye.ts
function calculateGrossPaye(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  let tax = 0;
  for (const bracket of PAYE_BRACKETS) {
    if (income <= bracket.min) break;
    const upper = Math.min(income, bracket.max);
    tax += (upper - bracket.min) * bracket.rate;
  }
  return tax;
}

export function calculatePaye(taxableIncome: number): TaxResult {
  const grossTax = round2(calculateGrossPaye(taxableIncome));
  const netTax = round2(Math.max(0, grossTax - PERSONAL_RELIEF));
  return { code: 'PAYE', taxableIncome: round2(Math.max(0, taxableIncome)), grossTax, relief: PERSONAL_RELIEF, netTax };
}
```

NSSF is a two-tier contribution:

```typescript
// countries/kenya/nssf.ts
export function calculateNssf(grossPay: number): StatutoryDeductionLine {
  const tier1 = Math.min(grossPay, NSSF_TIERS.tier1.upperLimit) * NSSF_TIERS.tier1.rate;
  const tier2Base = Math.max(0, Math.min(grossPay, NSSF_TIERS.tier2.upperLimit) - NSSF_TIERS.tier2.lowerLimit);
  const tier2 = tier2Base * NSSF_TIERS.tier2.rate;
  const employeeAmount = round2(tier1 + tier2);
  return { code: 'NSSF', label: 'NSSF', employeeAmount, employerAmount: employeeAmount };
}
```

SHIF (the current scheme) is a flat percentage with a floor:

```typescript
// countries/kenya/shif.ts
export function calculateShif(grossPay: number): StatutoryDeductionLine {
  const employeeAmount = Math.max(SHIF_MINIMUM_CONTRIBUTION, round2(grossPay * SHIF_RATE));
  return { code: 'SHIF', label: 'Social Health Insurance Fund', employeeAmount, employerAmount: 0 };
}
```

Housing Levy is a flat, uncapped percentage matched by the employer:

```typescript
// countries/kenya/housingLevy.ts
export function calculateHousingLevy(grossPay: number): StatutoryDeductionLine {
  const amount = round2(grossPay * HOUSING_LEVY_RATE);
  return { code: 'HOUSING_LEVY', label: 'Affordable Housing Levy', employeeAmount: amount, employerAmount: amount };
}
```

Both versions of Kenya's `CountryRuleSet` share the same `calculateEarnings`/`validate` and only differ in which health-scheme function they call:

```typescript
// countries/kenya/index.ts
export const kenyaV1: CountryRuleSet = {
  countryCode: 'KE', version: KENYA_V1_VERSION, effectiveFrom: KENYA_V1_EFFECTIVE_FROM, currency: 'KES',
  calculateEarnings,
  calculateStatutoryDeductions: ({ grossPay }) => [
    calculateNssf(grossPay), calculateNhif(grossPay), calculateHousingLevy(grossPay),
  ],
  calculateTax: ({ grossPay, statutoryDeductions }) => {
    // NSSF, NHIF and Housing Levy are all pre-tax deductible (Finance Act 2023)
    const deductible = sum(statutoryDeductions.map((d) => d.employeeAmount));
    return calculatePaye(grossPay - deductible);
  },
  validate,
};

export const kenyaV2: CountryRuleSet = {
  countryCode: 'KE', version: KENYA_V2_VERSION, effectiveFrom: KENYA_V2_EFFECTIVE_FROM, currency: 'KES',
  calculateEarnings,
  calculateStatutoryDeductions: ({ grossPay }) => [
    calculateNssf(grossPay), calculateShif(grossPay), calculateHousingLevy(grossPay),
  ],
  calculateTax: ({ grossPay, statutoryDeductions }) => {
    const deductible = sum(statutoryDeductions.map((d) => d.employeeAmount));
    return calculatePaye(grossPay - deductible);
  },
  validate,
};

export const kenyaRuleSets: CountryRuleSet[] = [kenyaV1, kenyaV2];
```

A payroll period dated before 1 Oct 2024 resolves to `kenyaV1` (NHIF); on or after resolves to `kenyaV2` (SHIF) — automatically, via `getCountryRuleSet('KE', periodDate)`.

## 3.8 Nigeria (NG)

```typescript
// countries/nigeria/constants.ts
export const ANNUAL_PAYE_BRACKETS = [
  { min: 0, max: 300_000, rate: 0.07 },
  { min: 300_000, max: 600_000, rate: 0.11 },
  { min: 600_000, max: 1_100_000, rate: 0.15 },
  { min: 1_100_000, max: 1_600_000, rate: 0.19 },
  { min: 1_600_000, max: 3_200_000, rate: 0.21 },
  { min: 3_200_000, max: Infinity, rate: 0.24 },
];
export const PENSION_EMPLOYEE_RATE = 0.08;  // Pension Reform Act
export const PENSION_EMPLOYER_RATE = 0.10;
export const NHF_EMPLOYEE_RATE = 0.025;     // National Housing Fund Act, employee-only
```

```typescript
// countries/nigeria/pension.ts
export function calculatePension(grossPay: number): StatutoryDeductionLine {
  return {
    code: 'PENSION', label: 'Pension (PRA 2014)',
    employeeAmount: round2(grossPay * PENSION_EMPLOYEE_RATE),
    employerAmount: round2(grossPay * PENSION_EMPLOYER_RATE),
  };
}

// countries/nigeria/nhf.ts — National Housing Fund, 2.5% of BASIC (not gross), no employer match
export function calculateNhf(basicSalary: number): StatutoryDeductionLine {
  return {
    code: 'NHF', label: 'National Housing Fund',
    employeeAmount: round2(basicSalary * NHF_EMPLOYEE_RATE), employerAmount: 0,
  };
}
```

```typescript
// countries/nigeria/index.ts
export const nigeriaV1: CountryRuleSet = {
  countryCode: 'NG', version: NIGERIA_V1_VERSION, effectiveFrom: NIGERIA_V1_EFFECTIVE_FROM, currency: 'NGN',
  calculateEarnings,
  calculateStatutoryDeductions: ({ grossPay, earnings }) => [
    calculatePension(grossPay),
    calculateNhf(earnings.basicSalary), // note: basic salary, not gross pay
  ],
  calculateTax: ({ grossPay, statutoryDeductions }) => {
    const deductible = sum(statutoryDeductions.map((d) => d.employeeAmount));
    return calculatePaye(grossPay - deductible);
  },
  validate,
};
export const nigeriaRuleSets: CountryRuleSet[] = [nigeriaV1];
```

## 3.9 South Africa (ZA)

South Africa's PAYE is the odd one out: SARS publishes *annual* tax bands with a base-tax-plus-marginal-rate formula, so the monthly taxable base has to be annualized, taxed, then divided back down — rather than walking brackets directly on the monthly figure like Kenya and Nigeria do.

```typescript
// countries/south-africa/constants.ts
export const ANNUAL_PAYE_BRACKETS = [
  { min: 0, max: 237_100, rate: 0.18, base: 0 },
  { min: 237_100, max: 370_500, rate: 0.26, base: 42_678 },
  { min: 370_500, max: 512_800, rate: 0.31, base: 77_362 },
  { min: 512_800, max: 673_000, rate: 0.36, base: 121_475 },
  { min: 673_000, max: 857_900, rate: 0.39, base: 179_147 },
  { min: 857_900, max: 1_817_000, rate: 0.41, base: 251_258 },
  { min: 1_817_000, max: Infinity, rate: 0.45, base: 644_489 },
]; // SARS 2024/25 tax year
export const ANNUAL_PRIMARY_REBATE = 17_235;
export const UIF_RATE = 0.01;               // 1% employee + 1% employer
export const UIF_MONTHLY_CEILING = 17_712;  // contribution base is capped
export const SDL_RATE = 0.01;               // employer-only
```

```typescript
// countries/south-africa/paye.ts
function calculateAnnualGrossTax(annualTaxableIncome: number): number {
  const income = Math.max(0, annualTaxableIncome);
  const bracket = [...ANNUAL_PAYE_BRACKETS].reverse().find((b) => income > b.min) ?? ANNUAL_PAYE_BRACKETS[0]!;
  return bracket.base + (income - bracket.min) * bracket.rate;
}

export function calculatePaye(monthlyTaxableIncome: number): TaxResult {
  const annualTaxable = Math.max(0, monthlyTaxableIncome) * 12;
  const annualGrossTax = calculateAnnualGrossTax(annualTaxable);
  const annualNetTax = Math.max(0, annualGrossTax - ANNUAL_PRIMARY_REBATE);
  const netTax = round2(annualNetTax / 12);
  return {
    code: 'PAYE', taxableIncome: round2(monthlyTaxableIncome),
    grossTax: round2(annualGrossTax / 12), relief: round2(ANNUAL_PRIMARY_REBATE / 12), netTax,
  };
}
```

```typescript
// countries/south-africa/uif.ts — capped at the monthly ceiling before applying the rate
export function calculateUif(grossPay: number): StatutoryDeductionLine {
  const contributionBase = Math.min(grossPay, UIF_MONTHLY_CEILING);
  const amount = round2(contributionBase * UIF_RATE);
  return { code: 'UIF', label: 'UIF', employeeAmount: amount, employerAmount: amount };
}

// countries/south-africa/sdl.ts — employer-only, never touches net pay or taxable income
export function calculateSdl(grossPay: number): StatutoryDeductionLine {
  return { code: 'SDL', label: 'Skills Development Levy', employeeAmount: 0, employerAmount: round2(grossPay * SDL_RATE) };
}
```

```typescript
// countries/south-africa/index.ts
export const southAfricaV1: CountryRuleSet = {
  countryCode: 'ZA', version: SOUTH_AFRICA_V1_VERSION, effectiveFrom: SOUTH_AFRICA_V1_EFFECTIVE_FROM, currency: 'ZAR',
  calculateEarnings,
  calculateStatutoryDeductions: ({ grossPay }) => [calculateUif(grossPay), calculateSdl(grossPay)],
  calculateTax: ({ grossPay }) => {
    // UIF is NOT tax-deductible under SARS rules (unlike retirement contributions), so PAYE runs on gross pay directly
    return calculatePaye(grossPay);
  },
  validate,
};
export const southAfricaRuleSets: CountryRuleSet[] = [southAfricaV1];
```

Note the deliberate asymmetry versus Kenya/Nigeria: South Africa's `calculateTax` ignores `statutoryDeductions` entirely, because UIF genuinely isn't a pre-tax deduction under SARS rules. Getting this wrong (subtracting UIF before computing PAYE) is exactly the kind of bug that produces a *plausible-looking but wrong* number — it was caught and fixed during this project's audit history precisely because the engine's country modules are isolated enough that a bracket/deductibility bug in one country never touches another's tests.

## 3.10 Testing the Engine

Because every function here is pure, tests are simple input→output assertions with no mocking:

```typescript
// __tests__/kenya.spec.ts
describe('Kenya payroll rules', () => {
  it('computes NHIF-era PAYE, NSSF, NHIF and Housing Levy for a mid-range salary', () => {
    const result = runPayrollCalculation(
      {
        employeeId: 'emp-1', countryCode: 'KE', currency: 'KES',
        earnings: { basicSalary: 50_000 },
        period: { periodStart: '2024-06-01', periodEnd: '2024-06-30' },
      },
      getCountryRuleSet('KE', new Date('2024-06-15')),
    );
    expect(result.ruleVersion).toBe('KE-2024.1'); // resolves to NHIF-era ruleset
    expect(result.statutoryDeductions.find((d) => d.code === 'NSSF')?.employeeAmount).toBe(2_160);
    // ...
  });

  it('resolves to the SHIF-era ruleset on or after 1 Oct 2024', () => {
    const ruleSet = getCountryRuleSet('KE', new Date('2024-10-01'));
    expect(ruleSet.version).toBe('KE-2024.2');
  });
});
```

Registry-level tests assert the version-resolution boundary itself (the day before vs. the day of a transition), and a `computeInputHash` test asserts that key order in the input object never changes the resulting hash — the actual guarantee idempotency depends on.
