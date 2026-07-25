import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: any;

  const company = { id: 'company-1', tenantId: 'tenant-1' };
  const employee = { id: 'emp-1', companyId: 'company-1', company };
  const record = {
    id: 'att-1',
    employeeId: 'emp-1',
    date: new Date('2026-07-01'),
    status: AttendanceStatus.PRESENT,
    employee: { ...employee, company },
  };

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: asyncMock(employee) },
      attendanceRecord: {
        upsert: asyncMock(record),
        findMany: asyncMock([record]),
        findUnique: asyncMock(record),
        update: asyncMock(record),
        delete: asyncMock(record),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  describe('record (upsert idempotency)', () => {
    const dto = {
      employeeId: 'emp-1',
      date: '2026-07-01',
      status: AttendanceStatus.PRESENT,
    };

    it('upserts on the employeeId_date compound key rather than creating duplicates', async () => {
      await service.record('tenant-1', 'user-1', dto);
      await service.record('tenant-1', 'user-1', {
        ...dto,
        status: AttendanceStatus.ABSENT,
      });

      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.attendanceRecord.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            employeeId_date: {
              employeeId: 'emp-1',
              date: new Date('2026-07-01'),
            },
          },
        }),
      );
      expect(prisma.attendanceRecord.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          update: expect.objectContaining({ status: AttendanceStatus.ABSENT }),
        }),
      );
    });

    it('throws NotFoundException when the employee is not in the tenant', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(service.record('tenant-1', 'user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });
  });

  describe('listForCompany (tenant isolation)', () => {
    it('scopes the query through employee.company.tenantId', async () => {
      await service.listForCompany('tenant-1', 'company-1', '2026-07-01');

      expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith({
        where: {
          date: new Date('2026-07-01'),
          employee: {
            companyId: 'company-1',
            company: { tenantId: 'tenant-1' },
          },
        },
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a cross-tenant attendance record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValueOnce({
        ...record,
        employee: { ...employee, company: { ...company, tenantId: 'other' } },
      });

      await expect(
        service.update('tenant-1', 'att-1', {
          status: AttendanceStatus.ABSENT,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.attendanceRecord.update).not.toHaveBeenCalled();
    });

    it('updates the record when it belongs to the tenant', async () => {
      const result = await service.update('tenant-1', 'att-1', {
        status: AttendanceStatus.ABSENT,
      });

      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: { status: AttendanceStatus.ABSENT },
      });
      expect(result).toBe(record);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for a cross-tenant attendance record', async () => {
      prisma.attendanceRecord.findUnique.mockResolvedValueOnce({
        ...record,
        employee: { ...employee, company: { ...company, tenantId: 'other' } },
      });

      await expect(service.remove('tenant-1', 'att-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.attendanceRecord.delete).not.toHaveBeenCalled();
    });

    it('deletes the record when it belongs to the tenant', async () => {
      await service.remove('tenant-1', 'att-1');

      expect(prisma.attendanceRecord.delete).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      });
    });
  });
});
