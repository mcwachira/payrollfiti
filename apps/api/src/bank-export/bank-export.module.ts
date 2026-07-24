import { Module } from '@nestjs/common';
import { BankExportService } from './bank-export.service';
import { BankExportController } from './bank-export.controller';

@Module({
  controllers: [BankExportController],
  providers: [BankExportService],
})
export class BankExportModule {}
