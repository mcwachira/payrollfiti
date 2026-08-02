import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoanStatus, LoanRepaymentStatus } from '@prisma/client';
import { LoansService } from './loans.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('LoansService', () => {
  let service: LoansService;
  let prisma: any;
  let notificationsService: any;

  const company = { id: 'company-1', tenantId: 'tenant-1' };
  const employee = {
    id: 'emp-1',
    companyId: 'company-1',
    company,
    currency: 'KES',
    user: { id: 'user-1' },
  };
  const loan = {
    id: 'loan-1',
    tenantId: 'tenant-1',
    employeeId: 'emp-1',
    principal: 90_000,
    currency: 'KES',
    installments: 3,
    installmentAmount: null,
    startPeriod: '2026-08',
    status: LoanStatus.PENDING,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-25T00:00:00Z'));

    prisma = {
      employee: { findUnique: asyncMock(employee) },
      loan: {
        create: asyncMock(loan),
        findUnique: asyncMock(loan),
        findMany: asyncMock([loan]),
        update: asyncMock({ ...loan }),
      },
      loanRepayment: {
        createMany: asyncMock({ count: 3 }),
        updateMany: asyncMock({ count: 1 }),
        update: asyncMock({}),
        findMany: asyncMock([]),
        count: asyncMock(0),
      },
      $transaction: jest.fn(),
    };
    notificationsService = { dispatch: asyncMock(undefined) };

    service = new LoansService(prisma, notificationsService);
  });

  describe('findAll', () => {
    it('includes the employee name/number so the UI can render without an extra lookup', async () => {
      await service.findAll('tenant-1', {});

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
                employeeNumber: true,
              },
            },
          },
        }),
      );
    });

    it('applies employeeId and status filters', async () => {
      await service.findAll('tenant-1', {
        employeeId: 'emp-1',
        status: LoanStatus.ACTIVE,
      });

      expect(prisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            employeeId: 'emp-1',
            status: LoanStatus.ACTIVE,
          },
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a PENDING loan and notifies the linked user', async () => {
      const result = await service.create('tenant-1', 'admin-1', {
        employeeId: 'emp-1',
        principal: 90_000,
        installments: 3,
        startPeriod: '2026-08',
      });

      expect(result).toBe(loan);
      expect(prisma.loan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          employeeId: 'emp-1',
          principal: 90_000,
          currency: 'KES',
          installments: 3,
          startPeriod: '2026-08',
          requestedById: 'admin-1',
          status: LoanStatus.PENDING,
        }),
      });
      expect(notificationsService.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'LOAN_REQUESTED',
        expect.any(String),
        expect.objectContaining({ metadata: { loanId: 'loan-1' } }),
      );
    });

    it('throws NotFoundException for an employee outside the tenant', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        ...employee,
        company: { id: 'company-1', tenantId: 'other-tenant' },
      });

      await expect(
        service.create('tenant-1', 'admin-1', {
          employeeId: 'emp-1',
          principal: 1000,
          installments: 1,
          startPeriod: '2026-08',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not notify when the employee has no linked user', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        ...employee,
        user: null,
      });

      await service.create('tenant-1', 'admin-1', {
        employeeId: 'emp-1',
        principal: 1000,
        installments: 1,
        startPeriod: '2026-08',
      });

      expect(notificationsService.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('rejects a pending loan and notifies the employee', async () => {
      const rejected = { ...loan, status: LoanStatus.REJECTED };
      prisma.loan.update.mockResolvedValueOnce(rejected);

      const result = await service.decide('tenant-1', 'admin-1', 'loan-1', {
        decision: 'REJECTED',
        reason: 'Budget constraints',
      });

      expect(result).toBe(rejected);
      expect(prisma.loan.update).toHaveBeenCalledWith({
        where: { id: 'loan-1' },
        data: expect.objectContaining({ status: LoanStatus.REJECTED }),
      });
      expect(notificationsService.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'LOAN_REJECTED',
        expect.stringContaining('Budget constraints'),
        expect.anything(),
      );
    });

    it('approves a pending loan, generating an even repayment schedule with the last installment absorbing rounding', async () => {
      const txLoanRepayment = { createMany: asyncMock({ count: 3 }) };
      const txLoan = {
        update: asyncMock({ ...loan, status: LoanStatus.ACTIVE }),
      };
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({ loanRepayment: txLoanRepayment, loan: txLoan }),
      );

      const oddLoan = { ...loan, principal: 100_000, installments: 3 };
      prisma.loan.findUnique.mockResolvedValueOnce(oddLoan);

      await service.decide('tenant-1', 'admin-1', 'loan-1', {
        decision: 'APPROVED',
      });

      const repaymentsData = txLoanRepayment.createMany.mock.calls[0][0].data;
      expect(repaymentsData).toEqual([
        {
          loanId: 'loan-1',
          installmentNo: 1,
          period: '2026-08',
          amountDue: 33_333.33,
        },
        {
          loanId: 'loan-1',
          installmentNo: 2,
          period: '2026-09',
          amountDue: 33_333.33,
        },
        {
          loanId: 'loan-1',
          installmentNo: 3,
          period: '2026-10',
          amountDue: 33_333.34,
        },
      ]);
      const sumOfInstallments = repaymentsData.reduce(
        (total: number, r: any) => total + r.amountDue,
        0,
      );
      expect(sumOfInstallments).toBe(100_000);

      expect(txLoan.update).toHaveBeenCalledWith({
        where: { id: 'loan-1' },
        data: expect.objectContaining({
          status: LoanStatus.ACTIVE,
          installmentAmount: 33_333.33,
          approvedById: 'admin-1',
        }),
      });
      expect(notificationsService.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'LOAN_APPROVED',
        expect.any(String),
        expect.anything(),
      );
    });

    it('throws BadRequestException when the loan is not PENDING', async () => {
      prisma.loan.findUnique.mockResolvedValueOnce({
        ...loan,
        status: LoanStatus.ACTIVE,
      });

      await expect(
        service.decide('tenant-1', 'admin-1', 'loan-1', {
          decision: 'APPROVED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a loan outside the tenant', async () => {
      prisma.loan.findUnique.mockResolvedValueOnce({
        ...loan,
        tenantId: 'other-tenant',
      });

      await expect(
        service.decide('tenant-1', 'admin-1', 'loan-1', {
          decision: 'APPROVED',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('payoff', () => {
    it('skips remaining pending installments and closes an active loan', async () => {
      prisma.loan.findUnique.mockResolvedValueOnce({
        ...loan,
        status: LoanStatus.ACTIVE,
      });
      const closed = { ...loan, status: LoanStatus.PAID_OFF };
      prisma.loan.update.mockResolvedValueOnce(closed);

      const result = await service.payoff('tenant-1', 'loan-1', {
        note: 'Paid in cash',
      });

      expect(result).toBe(closed);
      expect(prisma.loanRepayment.updateMany).toHaveBeenCalledWith({
        where: { loanId: 'loan-1', status: LoanRepaymentStatus.PENDING },
        data: { status: LoanRepaymentStatus.SKIPPED },
      });
      expect(prisma.loan.update).toHaveBeenCalledWith({
        where: { id: 'loan-1' },
        data: expect.objectContaining({ status: LoanStatus.PAID_OFF }),
      });
      expect(notificationsService.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'LOAN_PAID_OFF',
        expect.stringContaining('Paid in cash'),
        expect.anything(),
      );
    });

    it('throws BadRequestException for a loan that is not ACTIVE', async () => {
      await expect(service.payoff('tenant-1', 'loan-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resolvePayrollDeductions', () => {
    it('builds a voluntaryDeductions map keyed per loan for the due period', async () => {
      prisma.loanRepayment.findMany.mockResolvedValueOnce([
        { id: 'rep-1', loanId: 'loan-1', amountDue: 30_000 },
        { id: 'rep-2', loanId: 'loan-2', amountDue: 5_000 },
      ]);

      const result = await service.resolvePayrollDeductions(
        'tenant-1',
        'emp-1',
        '2026-08',
      );

      expect(result.voluntaryDeductions).toEqual({
        'LOAN_REPAYMENT_loan-1': 30_000,
        'LOAN_REPAYMENT_loan-2': 5_000,
      });
      expect(result.repayments).toEqual([
        { id: 'rep-1', loanId: 'loan-1', amountDue: 30_000 },
        { id: 'rep-2', loanId: 'loan-2', amountDue: 5_000 },
      ]);
      expect(prisma.loanRepayment.findMany).toHaveBeenCalledWith({
        where: {
          period: '2026-08',
          status: LoanRepaymentStatus.PENDING,
          loan: {
            employeeId: 'emp-1',
            tenantId: 'tenant-1',
            status: LoanStatus.ACTIVE,
          },
        },
      });
    });
  });

  describe('markRepaymentsPaid', () => {
    it('marks each repayment paid and links the payroll entry', async () => {
      prisma.loanRepayment.count.mockResolvedValueOnce(1); // still one pending -> loan stays open

      await service.markRepaymentsPaid(
        [{ id: 'rep-1', loanId: 'loan-1', amountDue: 30_000 }],
        'entry-1',
      );

      expect(prisma.loanRepayment.update).toHaveBeenCalledWith({
        where: { id: 'rep-1' },
        data: expect.objectContaining({
          status: LoanRepaymentStatus.PAID,
          amountPaid: 30_000,
          payrollEntryId: 'entry-1',
        }),
      });
      expect(prisma.loan.update).not.toHaveBeenCalled();
    });

    it('closes the loan and notifies the employee once every installment is paid', async () => {
      prisma.loanRepayment.count.mockResolvedValueOnce(0); // no more pending -> fully repaid
      const closed = {
        ...loan,
        tenantId: 'tenant-1',
        status: LoanStatus.PAID_OFF,
      };
      prisma.loan.update.mockResolvedValueOnce(closed);

      await service.markRepaymentsPaid(
        [{ id: 'rep-3', loanId: 'loan-1', amountDue: 33_333.34 }],
        'entry-3',
      );

      expect(prisma.loan.update).toHaveBeenCalledWith({
        where: { id: 'loan-1' },
        data: expect.objectContaining({ status: LoanStatus.PAID_OFF }),
      });
      expect(notificationsService.dispatch).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        'LOAN_FULLY_REPAID',
        expect.any(String),
        expect.anything(),
      );
    });

    it('never throws even when the update fails', async () => {
      prisma.loanRepayment.update.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.markRepaymentsPaid(
          [{ id: 'rep-1', loanId: 'loan-1', amountDue: 30_000 }],
          'entry-1',
        ),
      ).resolves.toBeUndefined();
    });
  });
});
