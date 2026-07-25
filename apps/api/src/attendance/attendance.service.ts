import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertEmployeeInTenant(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { company: true },
    });
    if (!employee || employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found');
    }
  }

  private async findOwned(tenantId: string, id: string) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: { employee: { include: { company: true } } },
    });
    if (!record || record.employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Attendance record not found');
    }
    return record;
  }

  /** Upsert makes re-submission idempotent per employee/day */
  async record(
    tenantId: string,
    recordedById: string,
    dto: CreateAttendanceDto,
  ) {
    await this.assertEmployeeInTenant(tenantId, dto.employeeId);
    const date = new Date(dto.date);
    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: {
        employeeId: dto.employeeId,
        date,
        status: dto.status,
        notes: dto.notes,
        recordedById,
      },
      update: {
        status: dto.status,
        notes: dto.notes,
        recordedById,
      },
    });
  }

  async listForEmployee(
    tenantId: string,
    employeeId: string,
    from?: string,
    to?: string,
  ) {
    await this.assertEmployeeInTenant(tenantId, employeeId);
    return this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async listForCompany(tenantId: string, companyId: string, date: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        date: new Date(date),
        employee: { companyId, company: { tenantId } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAttendanceDto) {
    await this.findOwned(tenantId, id);
    return this.prisma.attendanceRecord.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOwned(tenantId, id);
    await this.prisma.attendanceRecord.delete({ where: { id } });
  }
}
