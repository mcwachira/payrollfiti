import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BrandingService } from './branding.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  /** Pre-login pages (marketing site, login screen with no tenant context yet) */
  @Public()
  @Get('default')
  getDefault() {
    return this.brandingService.getDefaultBranding();
  }

  @Get()
  getBranding(@CurrentTenant() tenantId: string) {
    return this.brandingService.getBranding(tenantId);
  }

  @Roles(Role.ADMIN)
  @RequirePermission(Permission.BRANDING_MANAGE)
  @Patch()
  updateBranding(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.brandingService.upsertBranding(tenantId, dto);
  }
}
