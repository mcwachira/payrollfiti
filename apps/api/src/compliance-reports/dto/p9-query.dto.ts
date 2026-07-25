import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class P9QueryDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  /** e.g. "2026" */
  @Matches(/^\d{4}$/)
  taxYear!: string;
}
