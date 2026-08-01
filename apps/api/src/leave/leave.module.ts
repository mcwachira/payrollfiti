import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveBalancesController } from './leave-balances.controller';
import { EmployeesModule } from '../employees/employees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HolidaysModule } from '../holidays/holidays.module';

@Module({
  imports: [EmployeesModule, NotificationsModule, HolidaysModule],
  controllers: [
    LeaveTypesController,
    LeaveRequestsController,
    LeaveBalancesController,
  ],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
