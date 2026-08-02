import { IsNotEmpty, IsString, Matches } from 'class-validator';

/** Shared shape for annual per-employee tax certificate reports (P9, IRP5). */
export class EmployeeTaxYearQueryDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  /** e.g. "2026" */
  @Matches(/^\d{4}$/)
  taxYear!: string;
}
