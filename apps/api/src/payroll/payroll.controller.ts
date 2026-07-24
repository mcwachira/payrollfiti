import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../auth/types';

@Controller('payroll-runs')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Roles(Role.ADMIN, Role.HR)
  @Post()
  run(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: RunPayrollDto,
  ) {
    return this.payrollService.runPayroll(tenantId, user.id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.payrollService.findAll(tenantId, companyId);
  }

  /** Any authenticated user's own payslip history — must be registered before ':id' */
  @Get('mine')
  findMine(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.payrollService.findMine(tenantId, user.employeeId);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.payrollService.findOne(tenantId, id);
  }
}
