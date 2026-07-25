import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/types';

/** No @Roles() gating — any authenticated user manages only their own notifications. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.listForUser(
      tenantId,
      user.id,
      unreadOnly === 'true',
    );
  }

  @Patch(':id/read')
  markRead(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(tenantId, user.id, id);
  }

  @Post('read-all')
  markAllRead(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.notificationsService.markAllRead(tenantId, user.id);
  }
}
