import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { LeaveRequestStatus, Role } from '@prisma/client';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../auth/types';

@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    let employeeId: string;
    if (user.role === Role.EMPLOYEE) {
      if (dto.employeeId && dto.employeeId !== user.employeeId) {
        throw new ForbiddenException(
          'You may only create leave requests for yourself',
        );
      }
      if (!user.employeeId) {
        throw new ForbiddenException('No employee record linked to this user');
      }
      employeeId = user.employeeId;
    } else {
      if (!dto.employeeId) {
        throw new BadRequestException(
          'employeeId is required when creating a leave request on behalf of another employee',
        );
      }
      employeeId = dto.employeeId;
    }
    return this.leaveService.createLeaveRequest(tenantId, employeeId, dto);
  }

  /** Any authenticated user's own leave requests — must be registered before ':id' */
  @Get('mine')
  findMine(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.leaveService.findMine(tenantId, user.employeeId);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: LeaveRequestStatus,
  ) {
    return this.leaveService.listRequests(tenantId, { employeeId, status });
  }

  @Roles(Role.ADMIN, Role.HR)
  @Patch(':id/decision')
  decide(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveService.decide(tenantId, user.id, id, dto.decision);
  }
}
