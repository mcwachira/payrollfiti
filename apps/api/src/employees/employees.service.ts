import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
  ) {}

  async create(tenantId: string, dto: CreateEmployeeDto) {
    await this.tenantsService.assertCompanyBelongsToTenant(
      dto.companyId,
      tenantId,
    );
    return this.prisma.employee.create({
      data: {
        companyId: dto.companyId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        kraPin: dto.kraPin,
        nssfNumber: dto.nssfNumber,
        nhifNumber: dto.nhifNumber,
        jobRole: dto.jobRole,
        employmentType: dto.employmentType,
        currency: dto.currency ?? 'KES',
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        bankCode: dto.bankCode,
        bankBranchCode: dto.bankBranchCode,
      },
    });
  }

  async findAll(tenantId: string, companyId: string) {
    await this.tenantsService.assertCompanyBelongsToTenant(companyId, tenantId);
    return this.prisma.employee.findMany({
      where: { companyId },
      include: { contracts: true, salaryStructures: true },
    });
  }

  async findOne(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { contracts: true, salaryStructures: true, company: true },
    });
    if (!employee || employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async update(tenantId: string, employeeId: string, dto: UpdateEmployeeDto) {
    await this.findOne(tenantId, employeeId);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: dto,
    });
  }

  async remove(tenantId: string, employeeId: string) {
    await this.findOne(tenantId, employeeId);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { status: 'INACTIVE' },
    });
  }

  async addContract(
    tenantId: string,
    employeeId: string,
    dto: CreateContractDto,
  ) {
    await this.findOne(tenantId, employeeId);
    return this.prisma.contract.create({
      data: {
        employeeId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        terms: dto.terms as Prisma.InputJsonValue,
      },
    });
  }

  async addSalaryStructure(
    tenantId: string,
    employeeId: string,
    dto: CreateSalaryStructureDto,
  ) {
    await this.findOne(tenantId, employeeId);
    return this.prisma.salaryStructure.create({
      data: {
        employeeId,
        basicSalary: dto.basicSalary,
        allowances: dto.allowances as Prisma.InputJsonValue,
        currency: dto.currency,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      },
    });
  }

  /** Salary structure in effect for a given date — used by payroll runs */
  async getActiveSalaryStructure(employeeId: string, asOf: Date) {
    return this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
