import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LoanStatus, Role } from '@prisma/client';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DecideLoanDto } from './dto/decide-loan.dto';
import { PayoffLoanDto } from './dto/payoff-loan.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../auth/types';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Roles(Role.ADMIN, Role.HR)
  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreateLoanDto,
  ) {
    return this.loansService.create(tenantId, user.id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: LoanStatus,
  ) {
    return this.loansService.findAll(tenantId, { employeeId, status });
  }

  /** Any authenticated user's own loans — must be registered before ':id' */
  @Get('mine')
  findMine(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.loansService.findMine(tenantId, user.employeeId);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.loansService.findOne(tenantId, id);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Patch(':id/decision')
  decide(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: DecideLoanDto,
  ) {
    return this.loansService.decide(tenantId, user.id, id, dto);
  }

  @Roles(Role.ADMIN, Role.HR)
  @Patch(':id/payoff')
  payoff(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: PayoffLoanDto,
  ) {
    return this.loansService.payoff(tenantId, id, dto);
  }
}
