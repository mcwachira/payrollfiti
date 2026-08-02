import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Employee, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { TerminateEmployeeDto } from './dto/terminate-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  /** Decrypts the PII fields on a fetched Employee row before returning it to a caller. */
  private decryptEmployee<T extends Employee>(employee: T): T {
    return {
      ...employee,
      kraPin: this.encryptionService.decrypt(employee.kraPin),
      nssfNumber: this.encryptionService.decrypt(employee.nssfNumber),
      nhifNumber: this.encryptionService.decrypt(employee.nhifNumber),
      taxIdNumber: this.encryptionService.decrypt(employee.taxIdNumber),
      pensionNumber: this.encryptionService.decrypt(employee.pensionNumber),
      bankAccountNumber: this.encryptionService.decrypt(
        employee.bankAccountNumber,
      ),
    };
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    await this.tenantsService.assertCompanyBelongsToTenant(
      dto.companyId,
      tenantId,
    );
    const created = await this.prisma.employee.create({
      data: {
        companyId: dto.companyId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        kraPin: this.encryptionService.encrypt(dto.kraPin),
        nssfNumber: this.encryptionService.encrypt(dto.nssfNumber),
        nhifNumber: this.encryptionService.encrypt(dto.nhifNumber),
        taxIdNumber: this.encryptionService.encrypt(dto.taxIdNumber),
        pensionNumber: this.encryptionService.encrypt(dto.pensionNumber),
        jobRole: dto.jobRole,
        employmentType: dto.employmentType,
        currency: dto.currency ?? 'KES',
        bankName: dto.bankName,
        bankAccountNumber: this.encryptionService.encrypt(
          dto.bankAccountNumber,
        ),
        bankCode: dto.bankCode,
        bankBranchCode: dto.bankBranchCode,
      },
    });
    return this.decryptEmployee(created);
  }

  async findAll(tenantId: string, companyId: string) {
    await this.tenantsService.assertCompanyBelongsToTenant(companyId, tenantId);
    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      include: { contracts: true, salaryStructures: true },
    });
    return employees.map((employee) => this.decryptEmployee(employee));
  }

  async findOne(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { contracts: true, salaryStructures: true, company: true },
    });
    if (!employee || employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found');
    }
    return this.decryptEmployee(employee);
  }

  async update(tenantId: string, employeeId: string, dto: UpdateEmployeeDto) {
    await this.findOne(tenantId, employeeId);
    const data: Prisma.EmployeeUpdateInput = { ...dto };
    if (dto.kraPin !== undefined) {
      data.kraPin = this.encryptionService.encrypt(dto.kraPin);
    }
    if (dto.nssfNumber !== undefined) {
      data.nssfNumber = this.encryptionService.encrypt(dto.nssfNumber);
    }
    if (dto.nhifNumber !== undefined) {
      data.nhifNumber = this.encryptionService.encrypt(dto.nhifNumber);
    }
    if (dto.taxIdNumber !== undefined) {
      data.taxIdNumber = this.encryptionService.encrypt(dto.taxIdNumber);
    }
    if (dto.pensionNumber !== undefined) {
      data.pensionNumber = this.encryptionService.encrypt(dto.pensionNumber);
    }
    if (dto.bankAccountNumber !== undefined) {
      data.bankAccountNumber = this.encryptionService.encrypt(
        dto.bankAccountNumber,
      );
    }
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data,
    });
    return this.decryptEmployee(updated);
  }

  async remove(tenantId: string, employeeId: string) {
    await this.findOne(tenantId, employeeId);
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: { status: 'INACTIVE' },
    });
    return this.decryptEmployee(updated);
  }

  /**
   * Full offboarding: marks the employee TERMINATED, closes any still-open
   * contract as of the termination date, and revokes portal access (their
   * User account, if any, is deactivated and its refresh token cleared so
   * an existing session can't be used after this point). Excluded from
   * future payroll runs automatically via the existing `status: 'ACTIVE'`
   * filter in PayrollService — this does not attempt to prorate a final
   * paycheck for a mid-period termination; that's a separate, not-yet-built
   * payroll feature (see packages/payroll-rules proration support, which
   * exists in the engine but isn't wired to any real employment-end date
   * source yet).
   */
  async terminate(
    tenantId: string,
    actorId: string,
    employeeId: string,
    dto: TerminateEmployeeDto,
  ) {
    const employee = await this.findOne(tenantId, employeeId);
    if (employee.status === 'TERMINATED') {
      throw new BadRequestException('Employee is already terminated');
    }

    const terminationDate = dto.terminationDate
      ? new Date(dto.terminationDate)
      : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: employeeId },
        data: {
          status: 'TERMINATED',
          terminatedAt: terminationDate,
          terminationReason: dto.reason,
        },
      });

      await tx.contract.updateMany({
        where: { employeeId, endDate: null },
        data: { endDate: terminationDate },
      });

      await tx.user.updateMany({
        where: { employeeId },
        data: { isActive: false, refreshTokenHash: null },
      });

      return result;
    });

    await this.auditService.record({
      tenantId,
      actorId,
      action: 'employee.terminate',
      entityType: 'Employee',
      entityId: employeeId,
      before: { status: employee.status } as Prisma.InputJsonValue,
      after: {
        status: 'TERMINATED',
        terminatedAt: terminationDate.toISOString(),
        reason: dto.reason ?? null,
      } as Prisma.InputJsonValue,
    });

    return this.decryptEmployee(updated);
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
