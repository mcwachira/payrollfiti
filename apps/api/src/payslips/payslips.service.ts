import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService } from '../branding/branding.service';
import { PayslipDocument, PayslipLineItem } from './payslip.template';

const STORAGE_DIR =
  process.env.PAYSLIP_STORAGE_DIR ?? join(process.cwd(), 'storage', 'payslips');

@Injectable()
export class PayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandingService: BrandingService,
  ) {}

  async generate(tenantId: string, payrollEntryId: string) {
    const entry = await this.prisma.payrollEntry.findUnique({
      where: { id: payrollEntryId },
      include: {
        employee: { include: { company: true } },
        payrollRun: true,
      },
    });
    if (!entry || entry.employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Payroll entry not found');
    }

    const branding = await this.brandingService.getBranding(tenantId);

    const earnings = entry.earningsBreakdown as unknown as {
      basicSalary: number;
      allowanceBreakdown: Record<string, number>;
      overtimeAmount: number;
      commissionAmount: number;
      bonusAmount: number;
    };
    const statutory = entry.statutoryDeductions as unknown as Array<{
      label: string;
      employeeAmount: number;
    }>;
    const tax = entry.taxBreakdown as unknown as {
      code: string;
      netTax: number;
    };

    const earningLines: PayslipLineItem[] = [
      { label: 'Basic Salary', amount: earnings.basicSalary },
      ...Object.entries(earnings.allowanceBreakdown ?? {}).map(
        ([label, amount]) => ({ label, amount }),
      ),
    ];
    if (earnings.overtimeAmount)
      earningLines.push({ label: 'Overtime', amount: earnings.overtimeAmount });
    if (earnings.commissionAmount)
      earningLines.push({
        label: 'Commission',
        amount: earnings.commissionAmount,
      });
    if (earnings.bonusAmount)
      earningLines.push({ label: 'Bonus', amount: earnings.bonusAmount });

    const statutoryLines: PayslipLineItem[] = statutory.map((d) => ({
      label: d.label,
      amount: d.employeeAmount,
    }));

    const pdfBuffer = await renderToBuffer(
      PayslipDocument({
        branding,
        companyName: entry.employee.company.name,
        employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`,
        employeeNumber: entry.employee.employeeNumber,
        period: entry.payrollRun.period,
        currency: entry.currency,
        earnings: earningLines,
        statutoryDeductions: statutoryLines,
        tax: { label: tax.code, amount: tax.netTax },
        voluntaryDeductions: [],
        grossPay: entry.grossPay,
        totalDeductions: entry.totalDeductions,
        netPay: entry.netPay,
      }),
    );

    await mkdir(STORAGE_DIR, { recursive: true });
    const pdfPath = join(STORAGE_DIR, `${payrollEntryId}.pdf`);
    await writeFile(pdfPath, pdfBuffer);

    await this.prisma.payslip.upsert({
      where: { payrollEntryId },
      create: { payrollEntryId, pdfPath },
      update: { pdfPath, generatedAt: new Date() },
    });

    return pdfBuffer;
  }
}
