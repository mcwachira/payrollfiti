import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class RunPayrollDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  /** e.g. "2026-07" */
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  /** Recompute even if an identical run already exists */
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
