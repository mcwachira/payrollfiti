import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import {
  DocumentsController,
  EmployeeDocumentsController,
} from './documents.controller';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [EmployeeDocumentsController, DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
