import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { LeaveService } from './leave.service';
import { EmployeesService } from '../employees/employees.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/types';

@Controller('employees/:employeeId/leave-balances')
export class LeaveBalancesController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('employeeId') employeeId: string,
    @Query('year') year?: string,
  ) {
    // Throws NotFoundException on cross-tenant/unknown employee.
    await this.employeesService.findOne(tenantId, employeeId);
    if (user.role === Role.EMPLOYEE && user.employeeId !== employeeId) {
      throw new ForbiddenException('You may only view your own leave balances');
    }
    const resolvedYear = year ? Number(year) : new Date().getFullYear();
    return this.leaveService.listBalances(tenantId, employeeId, resolvedYear);
  }
}
