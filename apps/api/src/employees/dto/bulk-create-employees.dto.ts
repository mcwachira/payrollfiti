import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

// Caps a single request at a size that stays comfortably inside a normal
// request timeout when each row is its own DB transaction (see
// EmployeesService.createBulk) — a company onboarding thousands of
// employees submits multiple batches, not one enormous request.
const MAX_BULK_ROWS = 500;

export class BulkCreateEmployeesDto {
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK_ROWS)
  employees!: CreateEmployeeDto[];
}
