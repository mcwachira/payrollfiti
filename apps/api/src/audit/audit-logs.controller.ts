import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';

@Controller('audit-logs')
@Roles(Role.ADMIN)
@RequirePermission(Permission.AUDIT_LOG_READ)
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: ListAuditLogsQueryDto,
  ) {
    return this.auditService.list(tenantId, query);
  }
}
