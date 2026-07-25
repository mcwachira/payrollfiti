import { Injectable, NotFoundException } from '@nestjs/common';
import { SalaryComponent, SalaryComponentType } from '@prisma/client';
import { round2 } from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { UpdateSalaryComponentDto } from './dto/update-salary-component.dto';

export interface ResolvedStructureEarnings {
  allowances: Record<string, number>;
  voluntaryDeductions: Record<string, number>;
}

@Injectable()
export class SalaryComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    tenantId: string,
    dto: CreateSalaryComponentDto,
  ): Promise<SalaryComponent> {
    return this.prisma.salaryComponent.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        calcType: dto.calcType,
        isTaxable: dto.isTaxable,
        defaultAmount: dto.defaultAmount,
        defaultRate: dto.defaultRate,
      },
    });
  }

  findAll(tenantId: string, activeOnly = true): Promise<SalaryComponent[]> {
    return this.prisma.salaryComponent.findMany({
      where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
    });
  }

  async findOne(tenantId: string, id: string): Promise<SalaryComponent> {
    const component = await this.prisma.salaryComponent.findUnique({
      where: { id },
    });
    if (!component || component.tenantId !== tenantId) {
      throw new NotFoundException('Salary component not found');
    }
    return component;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateSalaryComponentDto,
  ): Promise<SalaryComponent> {
    await this.findOne(tenantId, id);
    return this.prisma.salaryComponent.update({
      where: { id },
      data: dto,
    });
  }

  /** Soft delete — never hard-delete, the component may be referenced by historical SalaryStructureComponent rows */
  async deactivate(tenantId: string, id: string): Promise<SalaryComponent> {
    await this.findOne(tenantId, id);
    return this.prisma.salaryComponent.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Engine-integration seam: resolves a salary structure's per-component
   * earnings/deductions lines into the flat maps the payroll-rules engine
   * expects.
   *
   * Known limitation: SalaryComponent.isTaxable is stored/returned for
   * display/reporting only — the payroll-rules engine's tax calc doesn't
   * have a hook to exclude specific non-taxable earnings from taxable
   * income yet. That's a documented follow-up to packages/payroll-rules,
   * out of scope here.
   */
  async resolveStructureEarnings(
    structureId: string,
    basicSalary: number,
    legacyAllowances?: Record<string, number> | null,
  ): Promise<ResolvedStructureEarnings> {
    const lines = await this.prisma.salaryStructureComponent.findMany({
      where: { salaryStructureId: structureId },
      include: { salaryComponent: true },
    });

    if (lines.length === 0 && legacyAllowances != null) {
      return { allowances: legacyAllowances, voluntaryDeductions: {} };
    }

    const allowances: Record<string, number> = {};
    const voluntaryDeductions: Record<string, number> = {};

    for (const line of lines) {
      const component = line.salaryComponent;
      const amount =
        component.calcType === 'FIXED'
          ? (line.amount ?? component.defaultAmount ?? 0)
          : round2(
              basicSalary * ((line.rate ?? component.defaultRate ?? 0) / 100),
            );

      if (component.type === SalaryComponentType.EARNING) {
        allowances[component.code] = amount;
      } else {
        voluntaryDeductions[component.code] = amount;
      }
    }

    return { allowances, voluntaryDeductions };
  }
}
