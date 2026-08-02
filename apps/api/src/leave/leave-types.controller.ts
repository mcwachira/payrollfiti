import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';

@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveService: LeaveService) {}

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.LEAVE_TYPE_MANAGE)
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateLeaveTypeDto) {
    return this.leaveService.createLeaveType(tenantId, dto);
  }

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.leaveService.listLeaveTypes(tenantId);
  }
}
