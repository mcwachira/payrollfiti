import { Module } from '@nestjs/common';
import { ComplianceReportsService } from './compliance-reports.service';
import { ComplianceReportsController } from './compliance-reports.controller';
import { BrandingModule } from '../branding/branding.module';

@Module({
  imports: [BrandingModule],
  controllers: [ComplianceReportsController],
  providers: [ComplianceReportsService],
})
export class ComplianceReportsModule {}
