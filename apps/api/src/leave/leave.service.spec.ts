import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveRequestStatus, Role } from '@prisma/client';
import { LeaveService } from './leave.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HolidaysService } from '../holidays/holidays.service';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('LeaveService', () => {
  let service: LeaveService;
  let prisma: any;
  let notificationsService: any;

  const company = { id: 'company-1', tenantId: 'tenant-1' };
  const employee = { id: 'emp-1', companyId: 'company-1', company };

  const paidLeaveType = {
    id: 'lt-annual',
    tenantId: 'tenant-1',
    name: 'Annual',
    daysPerYear: 24,
    isPaid: true,
    isActive: true,
  };
  const unpaidLeaveType = {
    id: 'lt-unpaid',
    tenantId: 'tenant-1',
    name: 'Unpaid',
    daysPerYear: 0,
    isPaid: false,
    isActive: true,
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-24T00:00:00Z'));

    prisma = {
      leaveType: {
        create: asyncMock(paidLeaveType),
        findMany: asyncMock([paidLeaveType]),
        findUnique: asyncMock(paidLeaveType),
      },
      contract: {
        findFirst: asyncMock({ startDate: new Date('2020-01-01') }),
      },
      leaveBalance: {
        upsert: asyncMock({
          employeeId: 'emp-1',
          leaveTypeId: 'lt-annual',
          year: 2026,
          accruedDays: 12,
          usedDays: 0,
        }),
        update: asyncMock({}),
      },
      leaveRequest: {
        create: asyncMock({ id: 'req-1', status: LeaveRequestStatus.PENDING }),
        findMany: asyncMock([]),
        findUnique: asyncMock(null),
        update: asyncMock({}),
      },
      tenant: {
        findUniqueOrThrow: asyncMock({ id: 'tenant-1', countryCode: 'KE' }),
      },
    };

    notificationsService = {
      createForRoles: asyncMock(undefined),
      create: asyncMock(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        HolidaysService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(LeaveService);
  });

  describe('getOrCreateBalance (accrual formula)', () => {
    it('accrues half of daysPerYear for an employee whose contract started 6 months ago', async () => {
      prisma.contract.findFirst.mockResolvedValueOnce({
        startDate: new Date(Date.UTC(2026, 0, 24)), // Jan 24, 2026 -> 6 whole months to Jul 24
      });

      await service.getOrCreateBalance('tenant-1', 'emp-1', 'lt-annual', 2026);

      expect(prisma.leaveBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: 'emp-1',
              leaveTypeId: 'lt-annual',
              year: 2026,
            },
          },
          create: expect.objectContaining({ accruedDays: 12 }),
          update: { accruedDays: 12 },
        }),
      );
    });

    it('caps accrued days at daysPerYear once a full year has elapsed', async () => {
      // System time is mocked at 2026-07-24; requesting the balance for a
      // fully-completed past year (2020) exercises the full 12-month accrual.
      prisma.contract.findFirst.mockResolvedValueOnce({
        startDate: new Date('2015-01-01'),
      });

      await service.getOrCreateBalance('tenant-1', 'emp-1', 'lt-annual', 2020);

      const call = prisma.leaveBalance.upsert.mock.calls[0][0];
      expect(call.update.accruedDays).toBe(24);
    });

    it('throws NotFoundException for a cross-tenant leave type', async () => {
      prisma.leaveType.findUnique.mockResolvedValueOnce({
        ...paidLeaveType,
        tenantId: 'other-tenant',
      });

      await expect(
        service.getOrCreateBalance('tenant-1', 'emp-1', 'lt-annual', 2026),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createLeaveRequest', () => {
    const dto = {
      leaveTypeId: 'lt-annual',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
    };

    it('rejects when the accrued balance is insufficient', async () => {
      prisma.leaveBalance.upsert.mockResolvedValueOnce({
        accruedDays: 1,
        usedDays: 0,
      });

      await expect(
        service.createLeaveRequest('tenant-1', 'emp-1', dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('creates the request as PENDING when the balance is sufficient', async () => {
      prisma.leaveBalance.upsert.mockResolvedValueOnce({
        accruedDays: 12,
        usedDays: 0,
      });

      const result = await service.createLeaveRequest('tenant-1', 'emp-1', dto);

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeId: 'emp-1',
            leaveTypeId: 'lt-annual',
            daysRequested: 3,
            status: LeaveRequestStatus.PENDING,
          }),
        }),
      );
      expect(result).toEqual({
        id: 'req-1',
        status: LeaveRequestStatus.PENDING,
      });
      expect(notificationsService.createForRoles).toHaveBeenCalledWith(
        'tenant-1',
        [Role.ADMIN, Role.HR],
        'LEAVE_REQUEST_PENDING',
        expect.any(String),
        expect.objectContaining({ leaveRequestId: 'req-1' }),
      );
    });

    it('skips the balance check entirely for an unpaid leave type', async () => {
      prisma.leaveType.findUnique.mockResolvedValueOnce(unpaidLeaveType);

      await service.createLeaveRequest('tenant-1', 'emp-1', dto);

      expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
      expect(prisma.leaveRequest.create).toHaveBeenCalled();
    });

    it('throws NotFoundException for a cross-tenant leave type', async () => {
      prisma.leaveType.findUnique.mockResolvedValueOnce({
        ...paidLeaveType,
        tenantId: 'other-tenant',
      });

      await expect(
        service.createLeaveRequest('tenant-1', 'emp-1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it("excludes the tenant's country public holidays from daysRequested", async () => {
      prisma.leaveBalance.upsert.mockResolvedValueOnce({
        accruedDays: 12,
        usedDays: 0,
      });
      // Dec 11-13, 2026 inclusive = 3 calendar days; Dec 12 is Kenya's
      // Jamhuri Day, so only 2 should count against the balance.
      const holidayDto = {
        leaveTypeId: 'lt-annual',
        startDate: '2026-12-11',
        endDate: '2026-12-13',
      };

      await service.createLeaveRequest('tenant-1', 'emp-1', holidayDto);

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ daysRequested: 2 }),
        }),
      );
    });
  });

  describe('decide', () => {
    const pendingRequest = {
      id: 'req-1',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-annual',
      startDate: new Date('2026-07-01'),
      daysRequested: 3,
      status: LeaveRequestStatus.PENDING,
      employee: { ...employee, company },
      leaveType: paidLeaveType,
    };

    it('approves a pending request and increments usedDays on the balance', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(pendingRequest);
      prisma.leaveRequest.update.mockResolvedValueOnce({
        ...pendingRequest,
        status: LeaveRequestStatus.APPROVED,
      });

      const result = await service.decide(
        'tenant-1',
        'approver-1',
        'req-1',
        'APPROVED',
      );

      expect(prisma.leaveBalance.update).toHaveBeenCalledWith({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: 'emp-1',
            leaveTypeId: 'lt-annual',
            year: 2026,
          },
        },
        data: { usedDays: { increment: 3 } },
      });
      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
    });

    it('notifies the linked user when a request is decided', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValueOnce({
        ...pendingRequest,
        employee: { ...employee, company, user: { id: 'user-emp-1' } },
      });
      prisma.leaveRequest.update.mockResolvedValueOnce({
        ...pendingRequest,
        status: LeaveRequestStatus.APPROVED,
      });

      await service.decide('tenant-1', 'approver-1', 'req-1', 'APPROVED');

      expect(notificationsService.create).toHaveBeenCalledWith(
        'tenant-1',
        'user-emp-1',
        'LEAVE_REQUEST_DECIDED',
        expect.any(String),
        expect.objectContaining({ leaveRequestId: 'req-1' }),
      );
    });

    it('skips the notification when the employee has no linked user login', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(pendingRequest);
      prisma.leaveRequest.update.mockResolvedValueOnce({
        ...pendingRequest,
        status: LeaveRequestStatus.APPROVED,
      });

      await service.decide('tenant-1', 'approver-1', 'req-1', 'APPROVED');

      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('rejects deciding an already-decided request a second time', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValueOnce({
        ...pendingRequest,
        status: LeaveRequestStatus.APPROVED,
      });

      await expect(
        service.decide('tenant-1', 'approver-1', 'req-1', 'APPROVED'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a cross-tenant leave request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValueOnce({
        ...pendingRequest,
        employee: { ...employee, company: { ...company, tenantId: 'other' } },
      });

      await expect(
        service.decide('tenant-1', 'approver-1', 'req-1', 'APPROVED'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRequests (tenant isolation)', () => {
    it('scopes the query through employee.company.tenantId', async () => {
      await service.listRequests('tenant-1', {});

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: { company: { tenantId: 'tenant-1' } },
          }),
        }),
      );
    });
  });
});
