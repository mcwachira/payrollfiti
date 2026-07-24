import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  createCompany(tenantId: string, dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: { tenantId, name: dto.name, currency: dto.currency ?? 'KES' },
    });
  }

  listCompanies(tenantId: string) {
    return this.prisma.company.findMany({ where: { tenantId } });
  }

  /** Verifies a company belongs to the tenant before any nested resource is touched */
  async assertCompanyBelongsToTenant(companyId: string, tenantId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
    });
    if (!company)
      throw new NotFoundException('Company not found for this tenant');
    return company;
  }
}
