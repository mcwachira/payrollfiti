import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { PayslipsService } from './payslips.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@Controller('payslips')
export class PayslipsController {
  constructor(private readonly payslipsService: PayslipsService) {}

  @Get(':payrollEntryId')
  @Header('Content-Type', 'application/pdf')
  async download(
    @CurrentTenant() tenantId: string,
    @Param('payrollEntryId') payrollEntryId: string,
  ) {
    const buffer = await this.payslipsService.generate(
      tenantId,
      payrollEntryId,
    );
    return new StreamableFile(buffer, {
      disposition: `inline; filename="payslip-${payrollEntryId}.pdf"`,
    });
  }
}
