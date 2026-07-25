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
 * Kenya-only for this pass. Reads already-persisted PayrollEntry.statutoryDeductions
 * and PayrollEntry.taxBreakdown JSON columns — never recalculates. Every
 * public method asserts the tenant's country is Kenya up front so this
 * never silently mislabels another country's figures as KRA/NSSF/NHIF
 * filings.
 */
@Injectable()
export class ComplianceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandingService: BrandingService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private async assertKenyaCompany(tenantId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      include: { tenant: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found for this tenant');
    }
    if (company.tenant.countryCode !== 'KE') {
      throw new BadRequestException(
        'Compliance reports are currently only supported for Kenya (KE)',
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
    await this.assertKenyaCompany(tenantId, companyId);

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
    await this.assertKenyaCompany(tenantId, companyId);
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
      totalNhif += findLine(statutory, 'NHIF')?.employeeAmount ?? 0;
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
    await this.assertKenyaCompany(tenantId, companyId);
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

  /** One row per employee — NHIF employee contribution for the period, for remittance. */
  async generateNhifRemittanceCsv(
    tenantId: string,
    companyId: string,
    period: string,
  ): Promise<string> {
    await this.assertKenyaCompany(tenantId, companyId);
    const run = await this.findLatestRun(companyId, period);

    const rows = run.entries.map((entry) => {
      const statutory =
        entry.statutoryDeductions as unknown as StatutoryDeductionLine[];
      const nhif = findLine(statutory, 'NHIF');
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
}
