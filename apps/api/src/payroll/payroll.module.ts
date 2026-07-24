import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { RulesCacheService } from './rules-cache.service';
import { TenantsModule } from '../tenants/tenants.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [TenantsModule, EmployeesModule],
  controllers: [PayrollController],
  providers: [PayrollService, RulesCacheService],
  exports: [PayrollService],
})
export class PayrollModule {}
