import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';

@Controller('webhooks')
@Roles(Role.ADMIN)
@RequirePermission(Permission.WEBHOOK_MANAGE)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(tenantId, dto);
  }

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.webhooksService.list(tenantId);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.webhooksService.remove(tenantId, id);
  }

  @Get(':id/deliveries')
  listDeliveries(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.webhooksService.listDeliveries(tenantId, id);
  }
}
