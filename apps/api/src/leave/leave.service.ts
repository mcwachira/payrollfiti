import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole calendar months elapsed from `start` to `end` (0 if `end` is before `start`) */
function wholeMonthsBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createLeaveType(tenantId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: {
        tenantId,
        name: dto.name,
        daysPerYear: dto.daysPerYear,
        isPaid: dto.isPaid ?? true,
      },
    });
  }

  async listLeaveTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Monthly pro-rated accrual, computed lazily on every read/write (no cron).
   * accruedDays = min(daysPerYear, monthsElapsed * daysPerYear / 12), where
   * monthsElapsed runs from max(Jan 1 of `year`, employee's earliest contract
   * start date) to min(today, Dec 31 of `year`). Recomputing and upserting
   * accruedDays on every call keeps it monotonic/idempotent; usedDays is left
   * untouched here — it only changes when a leave request is approved.
   *
   * Deliberate scope cuts: no annual-upfront-grant option, no carry-over
   * between years, no cron-based nightly accrual job.
   */
  async getOrCreateBalance(
    tenantId: string,
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });
    if (!leaveType || leaveType.tenantId !== tenantId) {
      throw new NotFoundException('Leave type not found');
    }

    const earliestContract = await this.prisma.contract.findFirst({
      where: { employeeId },
      orderBy: { startDate: 'asc' },
    });

    const jan1 = new Date(Date.UTC(year, 0, 1));
    // Exclusive upper bound (Jan 1 of the following year) rather than Dec 31 —
    // "whole calendar months" from Jan 1 to Dec 31 is only 11 months (one day
    // short of a full 12th month), which would make a full year of service
    // permanently under-accrue. Measuring up to the year boundary instead lets
    // a fully-elapsed year correctly reach all 12 months.
    const yearEndExclusive = new Date(Date.UTC(year + 1, 0, 1));
    const today = new Date();

    const periodStart =
      earliestContract && earliestContract.startDate > jan1
        ? earliestContract.startDate
        : jan1;
    const periodEnd = today < yearEndExclusive ? today : yearEndExclusive;

    const monthsElapsed = wholeMonthsBetween(periodStart, periodEnd);
    const accruedDays = Math.min(
      leaveType.daysPerYear,
      (monthsElapsed * leaveType.daysPerYear) / 12,
    );

    return this.prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
      create: { employeeId, leaveTypeId, year, accruedDays, usedDays: 0 },
      update: { accruedDays },
    });
  }

  async listBalances(tenantId: string, employeeId: string, year: number) {
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
    });
    return Promise.all(
      leaveTypes.map((leaveType) =>
        this.getOrCreateBalance(tenantId, employeeId, leaveType.id, year),
      ),
    );
  }

  async createLeaveRequest(
    tenantId: string,
    employeeId: string,
    dto: CreateLeaveRequestDto,
  ) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType || leaveType.tenantId !== tenantId) {
      throw new NotFoundException('Leave type not found');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
    // Calendar days inclusive — simplification: no weekend/public-holiday exclusion.
    const daysRequested =
      Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

    if (leaveType.isPaid) {
      const balance = await this.getOrCreateBalance(
        tenantId,
        employeeId,
        leaveType.id,
        startDate.getFullYear(),
      );
      if (balance.accruedDays - balance.usedDays < daysRequested) {
        throw new BadRequestException('Insufficient leave balance');
      }
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: leaveType.id,
        startDate,
        endDate,
        daysRequested,
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING,
      },
    });

    await this.notificationsService.createForRoles(
      tenantId,
      [Role.ADMIN, Role.HR],
      'LEAVE_REQUEST_PENDING',
      `A leave request from ${employeeId} for ${daysRequested} day(s) is pending approval.`,
      { leaveRequestId: request.id, employeeId },
    );

    return request;
  }

  async listRequests(
    tenantId: string,
    filters: { employeeId?: string; status?: LeaveRequestStatus },
  ) {
    return this.prisma.leaveRequest.findMany({
      where: {
        employee: { company: { tenantId } },
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMine(tenantId: string, employeeId: string | null) {
    if (!employeeId) return [];
    return this.prisma.leaveRequest.findMany({
      where: { employeeId, employee: { company: { tenantId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decide(
    tenantId: string,
    approverId: string,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: { include: { company: true, user: true } },
        leaveType: true,
      },
    });
    if (!request || request.employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Leave request not found');
    }
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException('Leave request has already been decided');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: decision as LeaveRequestStatus,
        approverId,
        decidedAt: new Date(),
      },
    });

    if (decision === 'APPROVED' && request.leaveType.isPaid) {
      // The balance row is guaranteed to exist because createLeaveRequest
      // already called getOrCreateBalance for this employee/leaveType/year.
      await this.prisma.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year: request.startDate.getFullYear(),
          },
        },
        data: { usedDays: { increment: request.daysRequested } },
      });
    }

    if (request.employee.user) {
      await this.notificationsService.create(
        tenantId,
        request.employee.user.id,
        'LEAVE_REQUEST_DECIDED',
        `Your leave request has been ${decision.toLowerCase()}.`,
        { leaveRequestId: request.id, decision },
      );
    }

    return updated;
  }
}
