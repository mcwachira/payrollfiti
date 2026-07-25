import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ComplianceReportsService } from './compliance-reports.service';
import { P9QueryDto } from './dto/p9-query.dto';
import { PeriodQueryDto } from './dto/period-query.dto';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('companies/:companyId/compliance-reports')
@Roles(Role.ADMIN, Role.HR)
export class ComplianceReportsController {
  constructor(
    private readonly complianceReportsService: ComplianceReportsService,
  ) {}

  @Get('p9')
  @Header('Content-Type', 'application/pdf')
  async p9(
    @CurrentTenant() tenantId: string,
    @Param('companyId') companyId: string,
    @Query() query: P9QueryDto,
  ) {
    const buffer = await this.complianceReportsService.generateP9(
      tenantId,
      companyId,
      query.employeeId,
      query.taxYear,
    );
    return new StreamableFile(buffer, {
      disposition: `inline; filename="p9-${query.employeeId}-${query.taxYear}.pdf"`,
    });
  }

  @Get('p10')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="p10.csv"')
  p10(
    @CurrentTenant() tenantId: string,
    @Param('companyId') companyId: string,
    @Query() query: PeriodQueryDto,
  ) {
    return this.complianceReportsService.generateP10Csv(
      tenantId,
      companyId,
      query.period,
    );
  }

  @Get('nssf-remittance')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="nssf-remittance.csv"')
  nssfRemittance(
    @CurrentTenant() tenantId: string,
    @Param('companyId') companyId: string,
    @Query() query: PeriodQueryDto,
  ) {
    return this.complianceReportsService.generateNssfRemittanceCsv(
      tenantId,
      companyId,
      query.period,
    );
  }

  @Get('nhif-remittance')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="nhif-remittance.csv"')
  nhifRemittance(
    @CurrentTenant() tenantId: string,
    @Param('companyId') companyId: string,
    @Query() query: PeriodQueryDto,
  ) {
    return this.complianceReportsService.generateNhifRemittanceCsv(
      tenantId,
      companyId,
      query.period,
    );
  }
}
