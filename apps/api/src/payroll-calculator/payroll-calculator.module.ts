import { Module } from '@nestjs/common';
import { PayrollCalculatorController } from './payroll-calculator.controller';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { RulesCacheService } from '../payroll/rules-cache.service';

@Module({
  controllers: [PayrollCalculatorController],
  providers: [PayrollCalculatorService, RulesCacheService],
})
export class PayrollCalculatorModule {}
