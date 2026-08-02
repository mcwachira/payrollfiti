import { IsDateString, IsOptional, IsString } from 'class-validator';

export class TerminateEmployeeDto {
  /** Defaults to now if omitted. */
  @IsDateString()
  @IsOptional()
  terminationDate?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
