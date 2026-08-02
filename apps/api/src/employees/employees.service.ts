import { randomBytes, createHash } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Employee, Prisma } from '@prisma/client';
import { getPricingForCountry } from '@repo/pricing';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../notifications/mail.service';
import { AppConfig } from '../config/configuration';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { TerminateEmployeeDto } from './dto/terminate-employee.dto';
import { CreateOnboardingTaskDto } from './dto/create-onboarding-task.dto';
import { UpdateOnboardingTaskDto } from './dto/update-onboarding-task.dto';
import { getDefaultOnboardingTasks } from './onboarding-task-templates';

@Injectable()
export class EmployeesService {
  private static readonly INVITE_EXPIRY_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppConfig, true>,
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

  /**
   * New employees start in ONBOARDING rather than ACTIVE — excluded from
   * payroll runs (PayrollService) and active-employee billing counts
   * (BillingService) until their onboarding checklist is completed via
   * completeOnboarding(). A default checklist (universal + country-specific
   * statutory IDs) is seeded in the same transaction as the employee row.
   */
  async create(tenantId: string, dto: CreateEmployeeDto) {
    await this.tenantsService.assertCompanyBelongsToTenant(
      dto.companyId,
      tenantId,
    );
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { countryCode: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId: dto.companyId,
          employeeNumber: dto.employeeNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          status: 'ONBOARDING',
          kraPin: this.encryptionService.encrypt(dto.kraPin),
          nssfNumber: this.encryptionService.encrypt(dto.nssfNumber),
          nhifNumber: this.encryptionService.encrypt(dto.nhifNumber),
          taxIdNumber: this.encryptionService.encrypt(dto.taxIdNumber),
          pensionNumber: this.encryptionService.encrypt(dto.pensionNumber),
          jobRole: dto.jobRole,
          department: dto.department,
          employmentType: dto.employmentType,
          currency:
            dto.currency ?? getPricingForCountry(tenant.countryCode).currency,
          bankName: dto.bankName,
          bankAccountNumber: this.encryptionService.encrypt(
            dto.bankAccountNumber,
          ),
          bankCode: dto.bankCode,
          bankBranchCode: dto.bankBranchCode,
        },
      });

      const tasks = getDefaultOnboardingTasks(tenant.countryCode);
      await tx.onboardingTask.createMany({
        data: tasks.map((task, index) => ({
          employeeId: employee.id,
          title: task.title,
          isRequired: task.isRequired,
          order: index,
        })),
      });

      return employee;
    });
    return this.decryptEmployee(created);
  }

  /**
   * One row per call to `create()` — deliberately, not a single bulk
   * INSERT — so every row gets exactly the same PII encryption and
   * onboarding-checklist seeding as a normal single-employee create,
   * through the exact same tenant-scoped code path (see the audit note on
   * this: a bulk endpoint that shortcuts that is the easiest way to
   * reintroduce a cross-tenant or plaintext-PII bug). Each row's `create()`
   * call has its own transaction, so one bad row fails independently
   * without rolling back the rows before it. Sequential rather than
   * concurrent: this runs rarely (once during onboarding, or an occasional
   * headcount import), so simplicity and independent per-row error
   * reporting matter more here than throughput.
   */
  async createBulk(
    tenantId: string,
    rows: CreateEmployeeDto[],
  ): Promise<
    Array<
      | { index: number; success: true; employee: Employee }
      | { index: number; success: false; error: string }
    >
  > {
    const results: Array<
      | { index: number; success: true; employee: Employee }
      | { index: number; success: false; error: string }
    > = [];
    for (const [index, dto] of rows.entries()) {
      try {
        const employee = await this.create(tenantId, dto);
        results.push({ index, success: true, employee });
      } catch (error) {
        results.push({
          index,
          success: false,
          error: this.describeBulkRowError(error),
        });
      }
    }
    return results;
  }

  /**
   * Prisma's own error message for a constraint violation includes an
   * internal file path and line number (e.g. "Invalid `tx.employee.create()`
   * invocation in .../employees.service.ts:63:42") — fine in a server log,
   * not something to hand back verbatim in an API response. Duplicate email
   * (P2002 on the unique `email` column) is by far the most common real
   * failure in a bulk import, so it gets a clean message; anything else
   * falls back to the exception's own message, which for the
   * NestJS/class-validator errors this method actually expects to see
   * (NotFoundException from assertCompanyBelongsToTenant, etc.) is already
   * client-appropriate.
   */
  private describeBulkRowError(error: unknown): string {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return 'An employee with this email already exists';
    }
    return error instanceof Error ? error.message : 'Failed to create employee';
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

  /**
   * Sends (or re-sends) a portal-access invite to an employee. This is the
   * only path that ever creates a User with role EMPLOYEE — nothing else
   * in the system does, so before this existed there was literally no way
   * for an employee to log in at all, even though the entire self-service
   * portal and "own records only" RBAC around it were already built.
   *
   * The raw token is emailed and never stored — only its SHA-256 hash is
   * (mirrors ApiKey's hashedKey pattern). Re-inviting an employee who
   * already has a pending invite just replaces it (upsert), which
   * invalidates the previous email's link; re-inviting one who already has
   * portal access is rejected outright rather than silently doing nothing.
   */
  async invite(tenantId: string, actorId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { company: true, user: true },
    });
    if (!employee || employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found');
    }
    if (employee.user) {
      throw new BadRequestException('This employee already has portal access');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + EmployeesService.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.employeeInvite.upsert({
      where: { employeeId },
      create: {
        employeeId,
        email: employee.email,
        tokenHash,
        expiresAt,
        createdById: actorId,
      },
      update: {
        email: employee.email,
        tokenHash,
        expiresAt,
        createdById: actorId,
      },
    });

    const corsOrigin = this.configService.get('corsOrigin', { infer: true });
    const inviteUrl = `${corsOrigin}/accept-invite?token=${rawToken}`;
    await this.mailService.sendMail(
      employee.email,
      "You're invited to the employee portal",
      `<p>Hi ${employee.firstName},</p>` +
        `<p>You've been invited to view your payslips and request leave or loans online.</p>` +
        `<p><a href="${inviteUrl}">Set up your account</a></p>` +
        `<p>This link expires in ${EmployeesService.INVITE_EXPIRY_DAYS} days.</p>`,
    );

    await this.auditService.record({
      tenantId,
      actorId,
      action: 'employee.invite',
      entityType: 'Employee',
      entityId: employeeId,
    });
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

  async listOnboardingTasks(tenantId: string, employeeId: string) {
    await this.findOne(tenantId, employeeId);
    return this.prisma.onboardingTask.findMany({
      where: { employeeId },
      orderBy: { order: 'asc' },
    });
  }

  async addOnboardingTask(
    tenantId: string,
    employeeId: string,
    dto: CreateOnboardingTaskDto,
  ) {
    await this.findOne(tenantId, employeeId);
    const maxOrder = await this.prisma.onboardingTask.aggregate({
      where: { employeeId },
      _max: { order: true },
    });
    return this.prisma.onboardingTask.create({
      data: {
        employeeId,
        title: dto.title,
        isRequired: dto.isRequired ?? true,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
  }

  async updateOnboardingTask(
    tenantId: string,
    employeeId: string,
    taskId: string,
    dto: UpdateOnboardingTaskDto,
  ) {
    await this.findOne(tenantId, employeeId);
    const task = await this.prisma.onboardingTask.findFirst({
      where: { id: taskId, employeeId },
    });
    if (!task) {
      throw new NotFoundException('Onboarding task not found');
    }
    return this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        completed: dto.completed,
        completedAt: dto.completed ? new Date() : null,
      },
    });
  }

  /**
   * Transitions an employee from ONBOARDING to ACTIVE, making them eligible
   * for payroll runs and active-employee billing counts. Refuses while any
   * required onboarding task is still incomplete — optional tasks don't
   * block this.
   */
  async completeOnboarding(
    tenantId: string,
    actorId: string,
    employeeId: string,
  ) {
    const employee = await this.findOne(tenantId, employeeId);
    if (employee.status !== 'ONBOARDING') {
      throw new BadRequestException(
        `Employee is not in ONBOARDING status (current status: ${employee.status})`,
      );
    }

    const incompleteRequired = await this.prisma.onboardingTask.count({
      where: { employeeId, isRequired: true, completed: false },
    });
    if (incompleteRequired > 0) {
      throw new BadRequestException(
        `${incompleteRequired} required onboarding task(s) are still incomplete`,
      );
    }

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: { status: 'ACTIVE' },
    });

    await this.auditService.record({
      tenantId,
      actorId,
      action: 'employee.onboarding.complete',
      entityType: 'Employee',
      entityId: employeeId,
      before: { status: 'ONBOARDING' } as Prisma.InputJsonValue,
      after: { status: 'ACTIVE' } as Prisma.InputJsonValue,
    });

    return this.decryptEmployee(updated);
  }
}
