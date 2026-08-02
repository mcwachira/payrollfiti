import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus, LoanRepaymentStatus } from '@prisma/client';
import { round2 } from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DecideLoanDto } from './dto/decide-loan.dto';
import { PayoffLoanDto } from './dto/payoff-loan.dto';

export interface DueLoanRepayment {
  id: string;
  loanId: string;
  amountDue: number;
}

/** period is "YYYY-MM"; returns the period `monthsToAdd` months later, in the same format. */
function addMonthsToPeriod(period: string, monthsToAdd: number): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(tenantId: string, actorId: string, dto: CreateLoanDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { company: true, user: true },
    });
    if (!employee || employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found');
    }

    const loan = await this.prisma.loan.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        principal: dto.principal,
        currency: employee.currency,
        installments: dto.installments,
        startPeriod: dto.startPeriod,
        reason: dto.reason,
        requestedById: actorId,
        status: LoanStatus.PENDING,
      },
    });

    if (employee.user) {
      await this.notificationsService.dispatch(
        tenantId,
        employee.user.id,
        'LOAN_REQUESTED',
        `A loan of ${employee.currency} ${dto.principal} has been requested on your behalf and is pending approval.`,
        { metadata: { loanId: loan.id } },
      );
    }

    return loan;
  }

  async findAll(
    tenantId: string,
    filters: { employeeId?: string; status?: LoanStatus },
  ) {
    return this.prisma.loan.findMany({
      where: {
        tenantId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Read-only loan + repayment schedule for the current user's own employee record — no admin/HR role required */
  async findMine(tenantId: string, employeeId: string | null) {
    if (!employeeId) return [];
    return this.prisma.loan.findMany({
      where: { tenantId, employeeId },
      include: { repayments: { orderBy: { installmentNo: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, loanId: string) {
    const loan = await this.findLoanOrThrow(tenantId, loanId);
    const repayments = await this.prisma.loanRepayment.findMany({
      where: { loanId },
      orderBy: { installmentNo: 'asc' },
    });
    const paidTotal = repayments
      .filter((r) => r.status === LoanRepaymentStatus.PAID)
      .reduce((sum, r) => sum + r.amountPaid, 0);

    return { ...loan, repayments, balance: round2(loan.principal - paidTotal) };
  }

  /**
   * Approves or rejects a PENDING loan. Approval is the only point the
   * repayment schedule (LoanRepayment rows) is generated — a rejected loan
   * never ties up future payroll periods.
   */
  async decide(
    tenantId: string,
    actorId: string,
    loanId: string,
    dto: DecideLoanDto,
  ) {
    const loan = await this.findLoanOrThrow(tenantId, loanId);
    if (loan.status !== LoanStatus.PENDING) {
      throw new BadRequestException(
        'Only pending loans can be approved or rejected',
      );
    }

    if (dto.decision === 'REJECTED') {
      const updated = await this.prisma.loan.update({
        where: { id: loanId },
        data: {
          status: LoanStatus.REJECTED,
          approvedById: actorId,
          decidedAt: new Date(),
          closedAt: new Date(),
        },
      });
      await this.notifyEmployee(
        tenantId,
        loan.employeeId,
        'LOAN_REJECTED',
        `Your loan request has been rejected${dto.reason ? `: ${dto.reason}` : '.'}`,
        { loanId },
      );
      return updated;
    }

    const installmentAmount = round2(loan.principal / loan.installments);
    const repaymentsData = Array.from({ length: loan.installments }, (_, i) => {
      const isLast = i === loan.installments - 1;
      const amountDue = isLast
        ? round2(loan.principal - installmentAmount * (loan.installments - 1))
        : installmentAmount;
      return {
        loanId,
        installmentNo: i + 1,
        period: addMonthsToPeriod(loan.startPeriod, i),
        amountDue,
      };
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.loanRepayment.createMany({ data: repaymentsData });
      return tx.loan.update({
        where: { id: loanId },
        data: {
          status: LoanStatus.ACTIVE,
          installmentAmount,
          approvedById: actorId,
          decidedAt: new Date(),
        },
      });
    });

    await this.notifyEmployee(
      tenantId,
      loan.employeeId,
      'LOAN_APPROVED',
      `Your loan of ${loan.currency} ${loan.principal} has been approved, to be repaid over ${loan.installments} installment(s) starting ${loan.startPeriod}.`,
      { loanId },
    );

    return updated;
  }

  /**
   * Closes an ACTIVE loan outside the payroll cycle (e.g. paid in cash).
   * Remaining PENDING installments are marked SKIPPED, not PAID — the
   * balance was settled by other means, not deducted from payroll.
   */
  async payoff(tenantId: string, loanId: string, dto: PayoffLoanDto) {
    const loan = await this.findLoanOrThrow(tenantId, loanId);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Only active loans can be paid off early');
    }

    await this.prisma.loanRepayment.updateMany({
      where: { loanId, status: LoanRepaymentStatus.PENDING },
      data: { status: LoanRepaymentStatus.SKIPPED },
    });
    const updated = await this.prisma.loan.update({
      where: { id: loanId },
      data: { status: LoanStatus.PAID_OFF, closedAt: new Date() },
    });

    await this.notifyEmployee(
      tenantId,
      loan.employeeId,
      'LOAN_PAID_OFF',
      `Your loan has been paid off early${dto.note ? `: ${dto.note}` : '.'}`,
      { loanId },
    );

    return updated;
  }

  /**
   * Called from PayrollService per employee, before the payroll run is
   * committed — folds any due installment(s) into the same
   * `deductions.voluntary` map salary components use, keyed per loan so
   * multiple concurrent loans stay distinguishable on the payslip.
   */
  async resolvePayrollDeductions(
    tenantId: string,
    employeeId: string,
    period: string,
  ): Promise<{
    voluntaryDeductions: Record<string, number>;
    repayments: DueLoanRepayment[];
  }> {
    const due = await this.prisma.loanRepayment.findMany({
      where: {
        period,
        status: LoanRepaymentStatus.PENDING,
        loan: { employeeId, tenantId, status: LoanStatus.ACTIVE },
      },
    });

    const voluntaryDeductions: Record<string, number> = {};
    for (const repayment of due) {
      voluntaryDeductions[`LOAN_REPAYMENT_${repayment.loanId}`] =
        repayment.amountDue;
    }

    return {
      voluntaryDeductions,
      repayments: due.map((r) => ({
        id: r.id,
        loanId: r.loanId,
        amountDue: r.amountDue,
      })),
    };
  }

  /**
   * Called from PayrollService once a run has already committed — never
   * throws, mirrors PayslipEmailService/WebhooksService: a failure here
   * must never fail the already-committed payroll-run HTTP response. Worst
   * case a repayment is reconciled manually later.
   */
  async markRepaymentsPaid(
    repayments: DueLoanRepayment[],
    payrollEntryId: string,
  ): Promise<void> {
    const affectedLoanIds = new Set<string>();
    try {
      for (const repayment of repayments) {
        await this.prisma.loanRepayment.update({
          where: { id: repayment.id },
          data: {
            status: LoanRepaymentStatus.PAID,
            amountPaid: repayment.amountDue,
            paidAt: new Date(),
            payrollEntryId,
          },
        });
        affectedLoanIds.add(repayment.loanId);
      }
    } catch (error) {
      this.logger.error('Failed to mark loan repayments paid', error as Error);
      return;
    }

    for (const loanId of affectedLoanIds) {
      await this.closeIfFullyRepaid(loanId);
    }
  }

  private async closeIfFullyRepaid(loanId: string): Promise<void> {
    try {
      const pendingCount = await this.prisma.loanRepayment.count({
        where: { loanId, status: LoanRepaymentStatus.PENDING },
      });
      if (pendingCount > 0) return;

      const loan = await this.prisma.loan.update({
        where: { id: loanId },
        data: { status: LoanStatus.PAID_OFF, closedAt: new Date() },
      });

      await this.notifyEmployee(
        loan.tenantId,
        loan.employeeId,
        'LOAN_FULLY_REPAID',
        'Your loan has been fully repaid.',
        { loanId },
      );
    } catch (error) {
      this.logger.error(
        `Failed to close fully-repaid loan ${loanId}`,
        error as Error,
      );
    }
  }

  private async findLoanOrThrow(tenantId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNumber: true },
        },
      },
    });
    if (!loan || loan.tenantId !== tenantId) {
      throw new NotFoundException('Loan not found');
    }
    return loan;
  }

  private async notifyEmployee(
    tenantId: string,
    employeeId: string,
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });
    if (employee?.user) {
      await this.notificationsService.dispatch(
        tenantId,
        employee.user.id,
        type,
        message,
        { metadata },
      );
    }
  }
}
