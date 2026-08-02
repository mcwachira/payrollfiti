import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TenantsService } from './tenants.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { AllowWithoutSubscription } from '../common/decorators/allow-without-subscription.decorator';

// Seeing/creating a Company is a prerequisite to having anything to bill in
// the first place (the onboarding wizard runs before a plan is chosen) —
// exempt from SubscriptionGuard so a lapsed tenant isn't locked out of the
// one screen that lets them see their own workspace exists.
@Controller('tenants')
@AllowWithoutSubscription()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  getMyTenant(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getTenant(tenantId);
  }

  @Get('companies')
  listCompanies(@CurrentTenant() tenantId: string) {
    return this.tenantsService.listCompanies(tenantId);
  }

  @Roles(Role.ADMIN)
  @RequirePermission(Permission.TENANT_MANAGE)
  @Post('companies')
  createCompany(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.tenantsService.createCompany(tenantId, dto);
  }
}
