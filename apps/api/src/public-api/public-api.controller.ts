import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { PayrollService } from '../payroll/payroll.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

/**
 * Scope cut: READ-ONLY only in this first pass — this module exposes
 * employees/payroll-runs listing for external integrations, no writes.
 *
 * `@Public()` skips the global JwtAuthGuard (which otherwise requires a
 * user JWT on every route); `@UseGuards(ApiKeyGuard)` then applies the
 * `X-API-Key` based auth in its place, populating `request.user` so the
 * existing `@CurrentTenant()`/`@CurrentUser()` decorators work unmodified.
 */
@Controller('public-api/v1')
@Public()
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly payrollService: PayrollService,
  ) {}

  @Get('employees')
  listEmployees(
    @CurrentTenant() tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.employeesService.findAll(tenantId, companyId);
  }

  @Get('payroll-runs')
  listPayrollRuns(
    @CurrentTenant() tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.payrollService.findAll(tenantId, companyId);
  }
}
