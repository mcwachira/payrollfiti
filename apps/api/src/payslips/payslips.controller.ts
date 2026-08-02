import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { PayslipsService } from './payslips.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/types';

@Controller('payslips')
export class PayslipsController {
  constructor(private readonly payslipsService: PayslipsService) {}

  @Get(':payrollEntryId')
  @Header('Content-Type', 'application/pdf')
  async download(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('payrollEntryId') payrollEntryId: string,
  ) {
    const buffer = await this.payslipsService.generate(
      tenantId,
      payrollEntryId,
      user,
    );
    return new StreamableFile(buffer, {
      disposition: `inline; filename="payslip-${payrollEntryId}.pdf"`,
    });
  }
}
