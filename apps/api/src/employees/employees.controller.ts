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
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles(Role.ADMIN, Role.HR)
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(tenantId, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
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
  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(tenantId, id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.employeesService.remove(tenantId, id);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Post(':id/contracts')
  addContract(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.employeesService.addContract(tenantId, id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Post(':id/salary-structures')
  addSalaryStructure(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateSalaryStructureDto,
  ) {
    return this.employeesService.addSalaryStructure(tenantId, id, dto);
  }
}
