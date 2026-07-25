import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';

@Controller('analytics')
@Roles(Role.ADMIN, Role.HR)
@RequirePermission(Permission.REPORTS_READ)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('payroll-cost')
  getPayrollCostBreakdown(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getPayrollCostBreakdown(
      tenantId,
      query.companyId,
      query.periodFrom,
      query.periodTo,
    );
  }

  @Get('tax-summary')
  getTaxSummary(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTaxSummary(
      tenantId,
      query.companyId,
      query.periodFrom,
      query.periodTo,
    );
  }
}
