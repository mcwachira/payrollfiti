import { Controller, Get, Header, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BankExportService } from './bank-export.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('payroll-runs/:payrollRunId/bank-export')
export class BankExportController {
  constructor(private readonly bankExportService: BankExportService) {}

  @Roles(Role.ADMIN, Role.HR)
  @Get()
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="bank-export.csv"')
  generate(
    @CurrentTenant() tenantId: string,
    @Param('payrollRunId') payrollRunId: string,
  ) {
    return this.bankExportService.generateCsv(tenantId, payrollRunId);
  }
}
