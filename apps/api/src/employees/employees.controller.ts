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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { BulkCreateEmployeesDto } from './dto/bulk-create-employees.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { TerminateEmployeeDto } from './dto/terminate-employee.dto';
import { CreateOnboardingTaskDto } from './dto/create-onboarding-task.dto';
import { UpdateOnboardingTaskDto } from './dto/update-onboarding-task.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/types';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/permissions/require-permission.decorator';
import { Permission } from '../common/permissions/permission.enum';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(tenantId, dto);
  }

  /**
   * Bulk create (CSV import) — one entry per row in the same order as the
   * request, each independently success/failure so a partial import is
   * fully diagnosable rather than an all-or-nothing 400.
   */
  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Post('bulk')
  createBulk(
    @CurrentTenant() tenantId: string,
    @Body() dto: BulkCreateEmployeesDto,
  ) {
    return this.employeesService.createBulk(tenantId, dto.employees);
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.employeesService.findAll(tenantId, companyId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.employeesService.findOne(tenantId, id);
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @RequirePermission(Permission.EMPLOYEE_TERMINATE)
  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.employeesService.remove(tenantId, id);
  }

  @Roles(Role.ADMIN)
  @RequirePermission(Permission.EMPLOYEE_TERMINATE)
  @Post(':id/terminate')
  terminate(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: TerminateEmployeeDto,
  ) {
    return this.employeesService.terminate(tenantId, user.id, id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Post(':id/contracts')
  addContract(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.employeesService.addContract(tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Post(':id/salary-structures')
  addSalaryStructure(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateSalaryStructureDto,
  ) {
    return this.employeesService.addSalaryStructure(tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Get(':id/onboarding-tasks')
  listOnboardingTasks(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.employeesService.listOnboardingTasks(tenantId, id);
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Post(':id/onboarding-tasks')
  addOnboardingTask(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateOnboardingTaskDto,
  ) {
    return this.employeesService.addOnboardingTask(tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Patch(':id/onboarding-tasks/:taskId')
  updateOnboardingTask(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateOnboardingTaskDto,
  ) {
    return this.employeesService.updateOnboardingTask(
      tenantId,
      id,
      taskId,
      dto,
    );
  }

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Post(':id/onboarding/complete')
  completeOnboarding(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.employeesService.completeOnboarding(tenantId, user.id, id);
  }
}
