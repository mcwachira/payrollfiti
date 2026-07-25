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
import { SalaryComponentsService } from './salary-components.service';
import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { UpdateSalaryComponentDto } from './dto/update-salary-component.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('salary-components')
@Roles(Role.ADMIN, Role.HR)
export class SalaryComponentsController {
  constructor(
    private readonly salaryComponentsService: SalaryComponentsService,
  ) {}

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSalaryComponentDto,
  ) {
    return this.salaryComponentsService.create(tenantId, dto);
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.salaryComponentsService.findAll(
      tenantId,
      activeOnly === undefined ? true : activeOnly !== 'false',
    );
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSalaryComponentDto,
  ) {
    return this.salaryComponentsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  deactivate(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.salaryComponentsService.deactivate(tenantId, id);
  }
}
