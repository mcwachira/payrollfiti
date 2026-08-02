import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { AuthenticatedRequestUser } from '../auth/types';

// Manual-entry CRUD only — real biometric/clock-in hardware integration is out of scope,
// this just ships a data model + write target for a future integration.
@Controller('attendance')
@Roles(Role.ADMIN, Role.HR)
@RequirePermission(Permission.ATTENDANCE_MANAGE)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  record(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendanceService.record(tenantId, user.id, dto);
  }

  @Get('employees/:employeeId')
  listForEmployee(
    @CurrentTenant() tenantId: string,
    @Param('employeeId') employeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.listForEmployee(
      tenantId,
      employeeId,
      from,
      to,
    );
  }

  @Get('companies/:companyId')
  listForCompany(
    @CurrentTenant() tenantId: string,
    @Param('companyId') companyId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.listForCompany(tenantId, companyId, date);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.attendanceService.remove(tenantId, id);
  }
}
