import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TenantsService } from './tenants.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('tenants')
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
  @Post('companies')
  createCompany(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.tenantsService.createCompany(tenantId, dto);
  }
}
