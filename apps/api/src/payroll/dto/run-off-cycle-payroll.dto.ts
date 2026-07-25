import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class RunOffCyclePayrollDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  employeeIds!: string[];

  /** e.g. "2026-07" */
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
