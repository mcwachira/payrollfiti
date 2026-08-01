import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { Public } from '../common/decorators/public.decorator';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { CalculatePayrollDto } from './dto/calculate-payroll.dto';
import { PayrollCalculatorDocument } from './payroll-calculator.template';

/**
 * Public, unauthenticated calculator used by the marketing site — no
 * persistence, no employee/company/tenant involved. Rate-limited by the
 * global ThrottlerGuard like every other route.
 */
@Controller('payroll-calculate')
@Public()
export class PayrollCalculatorController {
  constructor(private readonly calculatorService: PayrollCalculatorService) {}

  @Get('countries')
  listCountries() {
    return this.calculatorService.listSupportedCountries();
  }

  @Post()
  calculate(@Body() dto: CalculatePayrollDto) {
    return this.calculatorService.calculate(dto);
  }

  @Post('export/pdf')
  @Header('Content-Type', 'application/pdf')
  async exportPdf(@Body() dto: CalculatePayrollDto) {
    const result = await this.calculatorService.calculate(dto);
    const buffer = await renderToBuffer(PayrollCalculatorDocument({ result }));
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="payroll-estimate-${result.countryCode}.pdf"`,
    });
  }
}
