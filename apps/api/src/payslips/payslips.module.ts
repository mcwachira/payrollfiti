import { Module } from '@nestjs/common';
import { PayslipsService } from './payslips.service';
import { PayslipsController } from './payslips.controller';
import { BrandingModule } from '../branding/branding.module';

@Module({
  imports: [BrandingModule],
  controllers: [PayslipsController],
  providers: [PayslipsService],
  exports: [PayslipsService],
})
export class PayslipsModule {}
