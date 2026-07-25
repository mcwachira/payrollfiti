import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { AuthenticatedRequestUser } from '../auth/types';

@Controller('api-keys')
@Roles(Role.ADMIN)
@RequirePermission(Permission.API_KEY_MANAGE)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(tenantId, user.id, dto);
  }

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.apiKeysService.list(tenantId);
  }

  @Delete(':id')
  revoke(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.apiKeysService.revoke(tenantId, id);
  }
}
