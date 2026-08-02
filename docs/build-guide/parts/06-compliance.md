# Part 6 — Compliance Reports

Every report in this module reads already-persisted `PayrollEntry.statutoryDeductions` and `PayrollEntry.taxBreakdown` JSON columns — **it never recalculates**. This matters: a compliance report always reflects exactly what a payslip said at the time, even if the underlying rules have since changed, because it's reading history rather than re-deriving it.

## 6.1 Design: Country-Gated, JSON-Driven

Because `PayrollEntry` stores statutory deduction lines as a JSON array of `{ code, label, employeeAmount, employerAmount }` (Part 3 §3.2) rather than fixed columns, every report is really just "find the line with this `code`, sum it across employees or periods." A tiny helper does the lookup:

```typescript
function findLine(lines: StatutoryDeductionLine[], code: string): StatutoryDeductionLine | undefined {
  return lines.find((line) => line.code === code);
}
```

Kenya's health-insurance line needs a small twist: NHIF was replaced by SHIF on 1 Oct 2024 (Part 3 §3.7), so a report spanning both eras — a full-year P9, for instance — must resolve whichever code is actually present on each individual entry:

```typescript
function findHealthInsuranceLine(lines: StatutoryDeductionLine[]): StatutoryDeductionLine | undefined {
  return findLine(lines, 'SHIF') ?? findLine(lines, 'NHIF');
}
```

**Every report method asserts the tenant's actual country before doing anything else** — so a KRA P9 can never accidentally be generated for a Nigerian tenant just because a caller passed the wrong `companyId`:

```typescript
private async assertCompanyCountry(tenantId: string, companyId: string, expectedCountryCode: 'KE' | 'NG' | 'ZA') {
  const company = await this.prisma.company.findFirst({ where: { id: companyId, tenantId }, include: { tenant: true } });
  if (!company) throw new NotFoundException('Company not found for this tenant');
  if (company.tenant.countryCode !== expectedCountryCode) {
    throw new BadRequestException(`This report is only available for ${expectedCountryCode} tenants, but this tenant's country is ${company.tenant.countryCode}`);
  }
  return company;
}
```

**Scope honesty**: Nigeria and South Africa reports are documented as best-effort summaries built from the regulatory fields consistently required across states/SARS — they are explicitly *not* submission-ready FIRS TaxPro Max or SARS e@syFile exports, which need additional government-issued reference data this system doesn't hold. Kenya's KRA reports (P9/P10/NSSF/NHIF), by contrast, are the most complete because Kenya is the primary market.

## 6.2 Kenya — P9, P10, NSSF & NHIF/SHIF Remittance

**P9 (annual tax deduction card, PDF)** — one row per pay period across a tax year, for a single employee:

```typescript
async generateP9(tenantId: string, companyId: string, employeeId: string, taxYear: string): Promise<Buffer> {
  await this.assertCompanyCountry(tenantId, companyId, 'KE');

  const entries = await this.prisma.payrollEntry.findMany({
    where: { employeeId, payrollRun: { companyId, periodStart: { gte: yearStart }, periodEnd: { lte: yearEnd } } },
    include: { payrollRun: true, employee: { include: { company: true } } },
    orderBy: { payrollRun: { periodStart: 'asc' } },
  });
  if (entries.length === 0) throw new NotFoundException('No payroll entries found for this employee in the given tax year');

  const rows: P9MonthRow[] = entries.map((entry) => {
    const statutory = entry.statutoryDeductions as StatutoryDeductionLine[];
    const tax = entry.taxBreakdown as TaxResult;
    return {
      period: entry.payrollRun.period, grossPay: entry.grossPay,
      nssf: findLine(statutory, 'NSSF')?.employeeAmount ?? 0,
      taxableIncome: tax.taxableIncome, grossTax: tax.grossTax, relief: tax.relief, payeTax: tax.netTax,
    };
  });
  const totals = rows.reduce((acc, row) => ({ /* sum every numeric field, period: 'TOTAL' */ }), /* zeroed accumulator */);

  const employee = entries[0]!.employee;
  const branding = await this.brandingService.getBranding(tenantId);
  return renderToBuffer(P9Document({
    branding, companyName: employee.company.name, employeeName: `${employee.firstName} ${employee.lastName}`,
    kraPin: this.encryptionService.decrypt(employee.kraPin), // decrypted only at the point of rendering into the PDF
    taxYear, currency: entries[0]!.currency, rows, totals,
  }));
}
```

Note `kraPin` is decrypted only at the point it's needed for the PDF — everywhere else in the request path it stays ciphertext.

**P10 (monthly PAYE return, CSV)** and the **NSSF / NHIF-SHIF remittance schedules** all follow the same shape: find the company's latest run for the period, walk `run.entries`, pull the relevant line via `findLine`/`findHealthInsuranceLine`, format as CSV.

```typescript
const P10_CSV_HEADERS = ['period', 'employee_count', 'total_taxable_pay', 'total_paye', 'total_nssf', 'total_nhif'] as const;

async generateP10Csv(tenantId: string, companyId: string, period: string): Promise<string> {
  await this.assertCompanyCountry(tenantId, companyId, 'KE');
  const run = await this.findLatestRun(companyId, period);

  let totalTaxablePay = 0, totalPaye = 0, totalNssf = 0, totalNhif = 0;
  for (const entry of run.entries) {
    const statutory = entry.statutoryDeductions as StatutoryDeductionLine[];
    const tax = entry.taxBreakdown as TaxResult;
    totalTaxablePay += tax.taxableIncome;
    totalPaye += tax.netTax;
    totalNssf += findLine(statutory, 'NSSF')?.employeeAmount ?? 0;
    totalNhif += findHealthInsuranceLine(statutory)?.employeeAmount ?? 0; // resolves SHIF or NHIF per-entry
  }
  const row = [run.period, run.entries.length, totalTaxablePay.toFixed(2), totalPaye.toFixed(2), totalNssf.toFixed(2), totalNhif.toFixed(2)];
  return [P10_CSV_HEADERS.join(','), row.map(csvEscape).join(',')].join('\n');
}
```

`csvEscape` quotes any field containing a comma, quote, or newline and doubles embedded quotes — the minimum needed for a CSV that survives a name like `O'Brien, Jr.` intact:

```typescript
function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
```

NSSF and NHIF/SHIF remittance schedules are per-employee rows instead of one aggregate row — each includes the employee's decrypted statutory ID number (`nssfNumber`/`nhifNumber`) alongside the contribution amount, since that's what the remittance filing actually needs.

## 6.3 Nigeria — PAYE, Pension, NHF Remittance Schedules

Three CSV schedules, all gated to `'NG'` tenants, each pulling a different statutory line:

- **PAYE remittance** (`generatePayeRemittanceCsv`) — per-employee `taxIdNumber` (decrypted), `taxableIncome`, `netTax`. Due the 10th of the following month to the employee's State Internal Revenue Service.
- **Pension remittance** (`generatePensionRemittanceCsv`) — per-employee `pensionNumber` (RSA PIN, decrypted), employee (8%) and employer (10%) amounts plus their combined total. Due within 7 working days of payment, remittable to the employee's PFA/PFC.
- **NHF remittance** (`generateNhfRemittanceCsv`) — per-employee employee-only contribution (2.5% of basic, no employer match — Part 3 §3.8), remittable to the Federal Mortgage Bank of Nigeria.

```typescript
const NG_PENSION_CSV_HEADERS = ['employee_number', 'employee_name', 'rsa_pin', 'employee_amount', 'employer_amount', 'total'] as const;

async generatePensionRemittanceCsv(tenantId: string, companyId: string, period: string): Promise<string> {
  await this.assertCompanyCountry(tenantId, companyId, 'NG');
  const run = await this.findLatestRun(companyId, period);
  const rows = run.entries.map((entry) => {
    const pension = findLine(entry.statutoryDeductions as StatutoryDeductionLine[], 'PENSION');
    const employeeAmount = pension?.employeeAmount ?? 0, employerAmount = pension?.employerAmount ?? 0;
    return [
      entry.employee.employeeNumber ?? entry.employee.id,
      `${entry.employee.firstName} ${entry.employee.lastName}`,
      this.encryptionService.decrypt(entry.employee.pensionNumber) ?? '',
      employeeAmount.toFixed(2), employerAmount.toFixed(2), (employeeAmount + employerAmount).toFixed(2),
    ];
  });
  return [NG_PENSION_CSV_HEADERS.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
}
```

## 6.4 South Africa — EMP201 & IRP5

**EMP201** is a single aggregated declaration row (not per-employee) — PAYE + UIF (both employee and employer sides) + SDL for the whole company's run in a period, due to SARS by the 7th of the following month:

```typescript
const ZA_EMP201_CSV_HEADERS = ['period', 'employee_count', 'total_paye', 'total_uif_employee', 'total_uif_employer', 'total_sdl'] as const;

async generateEmp201Csv(tenantId: string, companyId: string, period: string): Promise<string> {
  await this.assertCompanyCountry(tenantId, companyId, 'ZA');
  const run = await this.findLatestRun(companyId, period);
  let totalPaye = 0, totalUifEmployee = 0, totalUifEmployer = 0, totalSdl = 0;
  for (const entry of run.entries) {
    const statutory = entry.statutoryDeductions as StatutoryDeductionLine[];
    const tax = entry.taxBreakdown as TaxResult;
    const uif = findLine(statutory, 'UIF'), sdl = findLine(statutory, 'SDL');
    totalPaye += tax.netTax;
    totalUifEmployee += uif?.employeeAmount ?? 0;
    totalUifEmployer += uif?.employerAmount ?? 0;
    totalSdl += sdl?.employerAmount ?? 0; // SDL is employer-only (Part 3 §3.9) — no employee-side field exists to sum
  }
  const row = [run.period, run.entries.length, totalPaye.toFixed(2), totalUifEmployee.toFixed(2), totalUifEmployer.toFixed(2), totalSdl.toFixed(2)];
  return [ZA_EMP201_CSV_HEADERS.join(','), row.map(csvEscape).join(',')].join('\n');
}
```

**IRP5** is the South African analogue of Kenya's P9: a best-effort annual employee tax-certificate summary PDF, one row per pay period in the tax year, with gross remuneration, UIF contribution, taxable income, and PAYE — structurally identical to `generateP9` (same year-window query, same per-row-then-totals reduction, same `renderToBuffer` + branding pattern) but reading South Africa's `UIF` line instead of Kenya's `NSSF` line.

## 6.5 Adding a Fourth Country's Compliance Reports

The pattern scales the same way the payroll engine does: add the country's `CountryCode` literal to `assertCompanyCountry`'s union type, write CSV header constants + a service method per required filing, and pull whichever `StatutoryDeductionLine.code` that country's ruleset produces (Part 3 §3.6's registry). No existing country's report method needs to change.
