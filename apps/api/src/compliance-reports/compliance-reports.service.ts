import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { StatutoryDeductionLine, TaxResult } from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService } from '../branding/branding.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { P9Document, P9MonthRow } from './p9.template';
import { Irp5Document, Irp5MonthRow } from './irp5.template';

const P10_CSV_HEADERS = [
  'period',
  'employee_count',
  'total_taxable_pay',
  'total_paye',
  'total_nssf',
  'total_nhif',
] as const;

const NSSF_CSV_HEADERS = [
  'employee_number',
  'employee_name',
  'nssf_number',
  'employee_amount',
  'employer_amount',
] as const;

const NHIF_CSV_HEADERS = [
  'employee_number',
  'employee_name',
  'nhif_number',
  'employee_amount',
] as const;

// Nigeria — monthly PAYE remittance schedule (per state IRS/SIRS). The exact
// template varies by state; these are the fields every SIRS requires per
// https://smartsmssolutions.com and https://taxsummaries.pwc.com guidance.
const NG_PAYE_CSV_HEADERS = [
  'employee_number',
  'employee_name',
  'tin',
  'taxable_income',
  'paye',
] as const;

// Nigeria — PenCom Form 003-style monthly pension contribution schedule.
const NG_PENSION_CSV_HEADERS = [
  'employee_number',
  'employee_name',
  'rsa_pin',
  'employee_amount',
  'employer_amount',
  'total',
] as const;

// Nigeria — National Housing Fund monthly remittance schedule to FMBN.
const NG_NHF_CSV_HEADERS = [
  'employee_number',
  'employee_name',
  'employee_amount',
] as const;

// South Africa — EMP201 monthly employer declaration to SARS: a single
// aggregated row for PAYE + UIF (employee & employer) + SDL.
const ZA_EMP201_CSV_HEADERS = [
  'period',
  'employee_count',
  'total_paye',
  'total_uif_employee',
  'total_uif_employer',
  'total_sdl',
] as const;

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function findLine(
  lines: StatutoryDeductionLine[],
  code: string,
): StatutoryDeductionLine | undefined {
  return lines.find((line) => line.code === code);
}

/**
 * NHIF was replaced by SHIF on 1 Oct 2024 (SHIF Act 2023). Entries from
 * payroll runs before that date carry an 'NHIF' statutory line; entries from
 * on/after that date carry 'SHIF' instead. Reports spanning both eras (e.g.
 * a P9 covering a full tax year) must resolve whichever is present per entry.
 */
function findHealthInsuranceLine(
  lines: StatutoryDeductionLine[],
): StatutoryDeductionLine | undefined {
  return findLine(lines, 'SHIF') ?? findLine(lines, 'NHIF');
}

/**
 * Supports Kenya, Nigeria, and South Africa statutory reports. Reads
 * already-persisted PayrollEntry.statutoryDeductions and
 * PayrollEntry.taxBreakdown JSON columns — never recalculates. Every public
 * method asserts the tenant's country up front so a report never silently
 * mislabels another country's figures as that country's filing (e.g. a KRA
 * P9 for a Nigerian tenant).
 *
 * Nigeria and South Africa reports are best-effort summaries built from the
 * regulatory fields that are consistently required (see per-method
 * comments); they are not submission-ready SARS e@syFile/FIRS TaxPro Max
 * exports, which need additional SARS/FIRS-issued reference data this
 * system doesn't hold.
 */
@Injectable()
export class ComplianceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandingService: BrandingService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private async assertCompanyCountry(
    tenantId: string,
    companyId: string,
    expectedCountryCode: 'KE' | 'NG' | 'ZA',
  ) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      include: { tenant: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found for this tenant');
    }
    if (company.tenant.countryCode !== expectedCountryCode) {
      throw new BadRequestException(
        `This report is only available for ${expectedCountryCode} tenants, but this tenant's country is ${company.tenant.countryCode}`,
      );
    }
    return company;
  }

  private async findLatestRun(companyId: string, period: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { companyId, period },
      orderBy: { createdAt: 'desc' },
      include: { entries: { include: { employee: true } } },
    });
    if (!run) {
      throw new NotFoundException('Payroll run not found for this period');
    }
    return run;
  }

  /** KRA P9 tax deduction card, one row per pay period in the given tax year, as a PDF. */
  async generateP9(
    tenantId: string,
    companyId: string,
    employeeId: string,
    taxYear: string,
  ): Promise<Buffer> {
    await this.assertCompanyCountry(tenantId, companyId, 'KE');

    const yearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${taxYear}-12-31T23:59:59.999Z`);

    const entries = await this.prisma.payrollEntry.findMany({
      where: {
        employeeId,
        payrollRun: {
          companyId,
          periodStart: { gte: yearStart },
          periodEnd: { lte: yearEnd },
        },
      },
      include: {
        payrollRun: true,
        employee: { include: { company: true } },
      },
      orderBy: { payrollRun: { periodStart: 'asc' } },
    });

    if (entries.length === 0) {
      throw new NotFoundException(
        'No payroll entries found for this employee in the given tax year',
      );
    }
    if (entries[0]!.employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found for this tenant');
    }

    const rows: P9MonthRow[] = entries.map((entry) => {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const tax = entry.taxBreakdown as unknown as TaxResult;
      const nssfLine = findLine(statutory, 'NSSF');
      return {
        period: entry.payrollRun.period,
        grossPay: entry.grossPay,
        nssf: nssfLine?.employeeAmount ?? 0,
        taxableIncome: tax.taxableIncome,
        grossTax: tax.grossTax,
        relief: tax.relief,
        payeTax: tax.netTax,
      };
    });

    const totals: P9MonthRow = rows.reduce(
      (acc, row) => ({
        period: 'TOTAL',
        grossPay: acc.grossPay + row.grossPay,
        nssf: acc.nssf + row.nssf,
        taxableIncome: acc.taxableIncome + row.taxableIncome,
        grossTax: acc.grossTax + row.grossTax,
        relief: acc.relief + row.relief,
        payeTax: acc.payeTax + row.payeTax,
      }),
      {
        period: 'TOTAL',
        grossPay: 0,
        nssf: 0,
        taxableIncome: 0,
        grossTax: 0,
        relief: 0,
        payeTax: 0,
      },
    );

    const employee = entries[0]!.employee;
    const branding = await this.brandingService.getBranding(tenantId);

    return renderToBuffer(
      P9Document({
        branding,
        companyName: employee.company.name,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeNumber: employee.employeeNumber,
        kraPin: this.encryptionService.decrypt(employee.kraPin),
        taxYear,
        currency: entries[0]!.currency,
        rows,
        totals,
      }),
    );
  }

  /** KRA P10 monthly PAYE return — single aggregated summary row for the company's latest run in the period. */
  async generateP10Csv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertCompanyCountry(tenantId, companyId, 'KE');
    const run = await this.findLatestRun(companyId, period);

    let totalTaxablePay = 0;
    let totalPaye = 0;
    let totalNssf = 0;
    let totalNhif = 0;

    for (const entry of run.entries) {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const tax = entry.taxBreakdown as unknown as TaxResult;
      totalTaxablePay += tax.taxableIncome;
      totalPaye += tax.netTax;
      totalNssf += findLine(statutory, 'NSSF')?.employeeAmount ?? 0;
      totalNhif += findHealthInsuranceLine(statutory)?.employeeAmount ?? 0;
    }

    const row = [
      run.period,
      run.entries.length,
      totalTaxablePay.toFixed(2),
      totalPaye.toFixed(2),
      totalNssf.toFixed(2),
      totalNhif.toFixed(2),
    ];

    return [P10_CSV_HEADERS.join(','), row.map(csvEscape).join(',')].join('\n');
  }

  /** One row per employee — NSSF employee/employer contributions for the period, for remittance. */
  async generateNssfRemittanceCsv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertCompanyCountry(tenantId, companyId, 'KE');
    const run = await this.findLatestRun(companyId, period);

    const rows = run.entries.map((entry) => {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const nssf = findLine(statutory, 'NSSF');
      return [
        entry.employee.employeeNumber ?? entry.employee.id,
        `${entry.employee.firstName} ${entry.employee.lastName}`,
        this.encryptionService.decrypt(entry.employee.nssfNumber) ?? '',
        (nssf?.employeeAmount ?? 0).toFixed(2),
        (nssf?.employerAmount ?? 0).toFixed(2),
      ];
    });

    const lines = [
      NSSF_CSV_HEADERS.join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ];
    return lines.join('\n');
  }

  /** One row per employee — NHIF/SHIF employee contribution for the period, for remittance. */
  async generateNhifRemittanceCsv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertCompanyCountry(tenantId, companyId, 'KE');
    const run = await this.findLatestRun(companyId, period);

    const rows = run.entries.map((entry) => {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const nhif = findHealthInsuranceLine(statutory);
      return [
        entry.employee.employeeNumber ?? entry.employee.id,
        `${entry.employee.firstName} ${entry.employee.lastName}`,
        this.encryptionService.decrypt(entry.employee.nhifNumber) ?? '',
        (nhif?.employeeAmount ?? 0).toFixed(2),
      ];
    });

    const lines = [
      NHIF_CSV_HEADERS.join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ];
    return lines.join('\n');
  }

  /**
   * Nigeria — one row per employee: monthly PAYE remittance schedule, the
   * common core of the schedule every State Internal Revenue Service (SIRS)
   * requires alongside the annual Form H1. Due the 10th of the following
   * month. State-specific template variations (if any) aren't modeled here.
   */
  async generatePayeRemittanceCsv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertCompanyCountry(tenantId, companyId, 'NG');
    const run = await this.findLatestRun(companyId, period);

    const rows = run.entries.map((entry) => {
      const tax = entry.taxBreakdown as unknown as TaxResult;
      return [
        entry.employee.employeeNumber ?? entry.employee.id,
        `${entry.employee.firstName} ${entry.employee.lastName}`,
        this.encryptionService.decrypt(entry.employee.taxIdNumber) ?? '',
        tax.taxableIncome.toFixed(2),
        tax.netTax.toFixed(2),
      ];
    });

    const lines = [
      NG_PAYE_CSV_HEADERS.join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ];
    return lines.join('\n');
  }

  /**
   * Nigeria — one row per employee: PenCom Form 003-style monthly pension
   * contribution schedule (8% employee + 10% employer = 18% combined),
   * remittable to the employee's PFA/PFC within 7 working days of payment.
   */
  async generatePensionRemittanceCsv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertCompanyCountry(tenantId, companyId, 'NG');
    const run = await this.findLatestRun(companyId, period);

    const rows = run.entries.map((entry) => {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const pension = findLine(statutory, 'PENSION');
      const employeeAmount = pension?.employeeAmount ?? 0;
      const employerAmount = pension?.employerAmount ?? 0;
      return [
        entry.employee.employeeNumber ?? entry.employee.id,
        `${entry.employee.firstName} ${entry.employee.lastName}`,
        this.encryptionService.decrypt(entry.employee.pensionNumber) ?? '',
        employeeAmount.toFixed(2),
        employerAmount.toFixed(2),
        (employeeAmount + employerAmount).toFixed(2),
      ];
    });

    const lines = [
      NG_PENSION_CSV_HEADERS.join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ];
    return lines.join('\n');
  }

  /**
   * Nigeria — one row per employee: National Housing Fund monthly
   * remittance schedule to the Federal Mortgage Bank of Nigeria (2.5% of
   * basic salary, employee-funded only — no employer match).
   */
  async generateNhfRemittanceCsv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertCompanyCountry(tenantId, companyId, 'NG');
    const run = await this.findLatestRun(companyId, period);

    const rows = run.entries.map((entry) => {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const nhf = findLine(statutory, 'NHF');
      return [
        entry.employee.employeeNumber ?? entry.employee.id,
        `${entry.employee.firstName} ${entry.employee.lastName}`,
        (nhf?.employeeAmount ?? 0).toFixed(2),
      ];
    });

    const lines = [
      NG_NHF_CSV_HEADERS.join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ];
    return lines.join('\n');
  }

  /**
   * South Africa — EMP201 monthly employer declaration: a single aggregated
   * row of PAYE + UIF (employee & employer) + SDL for the company's latest
   * run in the period. Due to SARS by the 7th of the following month.
   */
  async generateEmp201Csv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertCompanyCountry(tenantId, companyId, 'ZA');
    const run = await this.findLatestRun(companyId, period);

    let totalPaye = 0;
    let totalUifEmployee = 0;
    let totalUifEmployer = 0;
    let totalSdl = 0;

    for (const entry of run.entries) {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const tax = entry.taxBreakdown as unknown as TaxResult;
      const uif = findLine(statutory, 'UIF');
      const sdl = findLine(statutory, 'SDL');
      totalPaye += tax.netTax;
      totalUifEmployee += uif?.employeeAmount ?? 0;
      totalUifEmployer += uif?.employerAmount ?? 0;
      totalSdl += sdl?.employerAmount ?? 0;
    }

    const row = [
      run.period,
      run.entries.length,
      totalPaye.toFixed(2),
      totalUifEmployee.toFixed(2),
      totalUifEmployer.toFixed(2),
      totalSdl.toFixed(2),
    ];

    return [ZA_EMP201_CSV_HEADERS.join(','), row.map(csvEscape).join(',')].join(
      '\n',
    );
  }

  /** South Africa — best-effort IRP5-style annual employee tax certificate summary, one row per pay period in the given tax year, as a PDF. */
  async generateIrp5(
    tenantId: string,
    companyId: string,
    employeeId: string,
    taxYear: string,
  ): Promise<Buffer> {
    await this.assertCompanyCountry(tenantId, companyId, 'ZA');

    const yearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${taxYear}-12-31T23:59:59.999Z`);

    const entries = await this.prisma.payrollEntry.findMany({
      where: {
        employeeId,
        payrollRun: {
          companyId,
          periodStart: { gte: yearStart },
          periodEnd: { lte: yearEnd },
        },
      },
      include: {
        payrollRun: true,
        employee: { include: { company: true } },
      },
      orderBy: { payrollRun: { periodStart: 'asc' } },
    });

    if (entries.length === 0) {
      throw new NotFoundException(
        'No payroll entries found for this employee in the given tax year',
      );
    }
    if (entries[0]!.employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found for this tenant');
    }

    const rows: Irp5MonthRow[] = entries.map((entry) => {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const tax = entry.taxBreakdown as unknown as TaxResult;
      const uifLine = findLine(statutory, 'UIF');
      return {
        period: entry.payrollRun.period,
        grossRemuneration: entry.grossPay,
        uifContribution: uifLine?.employeeAmount ?? 0,
        taxableIncome: tax.taxableIncome,
        payeTax: tax.netTax,
      };
    });

    const totals: Irp5MonthRow = rows.reduce(
      (acc, row) => ({
        period: 'TOTAL',
        grossRemuneration: acc.grossRemuneration + row.grossRemuneration,
        uifContribution: acc.uifContribution + row.uifContribution,
        taxableIncome: acc.taxableIncome + row.taxableIncome,
        payeTax: acc.payeTax + row.payeTax,
      }),
      {
        period: 'TOTAL',
        grossRemuneration: 0,
        uifContribution: 0,
        taxableIncome: 0,
        payeTax: 0,
      },
    );

    const employee = entries[0]!.employee;
    const branding = await this.brandingService.getBranding(tenantId);

    return renderToBuffer(
      Irp5Document({
        branding,
        companyName: employee.company.name,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeNumber: employee.employeeNumber,
        taxIdNumber: this.encryptionService.decrypt(employee.taxIdNumber),
        taxYear,
        currency: entries[0]!.currency,
        rows,
        totals,
      }),
    );
  }
}
