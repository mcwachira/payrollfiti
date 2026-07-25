import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { EmployeesModule } from '../employees/employees.module';
import { PayrollModule } from '../payroll/payroll.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@Module({
  imports: [EmployeesModule, PayrollModule, ApiKeysModule],
  controllers: [PublicApiController],
  providers: [ApiKeyGuard],
})
export class PublicApiModule {}
