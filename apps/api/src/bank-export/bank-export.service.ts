import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';

const CSV_HEADERS = [
  'employee_number',
  'employee_name',
  'account_number',
  'bank_name',
  'bank_code',
  'branch_code',
  'amount',
  'currency',
  'reference',
] as const;

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

@Injectable()
export class BankExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async generateCsv(tenantId: string, payrollRunId: string): Promise<string> {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: { company: true, entries: { include: { employee: true } } },
    });
    if (!run || run.company.tenantId !== tenantId) {
      throw new NotFoundException('Payroll run not found');
    }

    const rows = run.entries.map((entry) => {
      const employee = entry.employee;
      const bankAccountNumber = this.encryptionService.decrypt(
        employee.bankAccountNumber,
      );
      const hasBankDetails = Boolean(bankAccountNumber && employee.bankName);
      return [
        employee.employeeNumber ?? employee.id,
        `${employee.firstName} ${employee.lastName}`,
        hasBankDetails ? bankAccountNumber! : 'MISSING',
        hasBankDetails ? employee.bankName! : 'MISSING',
        employee.bankCode ?? '',
        employee.bankBranchCode ?? '',
        entry.netPay.toFixed(2),
        entry.currency,
        `SAL-${run.period}-${employee.employeeNumber ?? employee.id}`,
      ];
    });

    const lines = [
      CSV_HEADERS.join(','),
      ...rows.map((row) => row.map(csvEscape).join(',')),
    ];
    return lines.join('\n');
  }
}
