import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { RulesCacheService } from './rules-cache.service';
import { TenantsModule } from '../tenants/tenants.module';
import { EmployeesModule } from '../employees/employees.module';
import { SalaryComponentsModule } from '../salary-components/salary-components.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LoansModule } from '../loans/loans.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TenantsModule,
    EmployeesModule,
    SalaryComponentsModule,
    NotificationsModule,
    WebhooksModule,
    LoansModule,
    AccountingModule,
  ],
  controllers: [PayrollController],
  providers: [PayrollService, RulesCacheService],
  exports: [PayrollService],
})
export class PayrollModule {}
