import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateLoanDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsNumber()
  @Min(1)
  principal!: number;

  @IsInt()
  @Min(1)
  installments!: number;

  /** First payroll period the deduction applies from, once approved, e.g. "2026-08" */
  @Matches(/^\d{4}-\d{2}$/)
  startPeriod!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
