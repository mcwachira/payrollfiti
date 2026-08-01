import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CalculatePayrollDto {
  /** ISO-3166 alpha-2 country code, e.g. "KE" */
  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsNumber()
  @Min(0)
  salary!: number;

  @IsOptional()
  @IsObject()
  allowances?: Record<string, number>;

  /** Voluntary deductions only — statutory deductions are computed by the ruleset */
  @IsOptional()
  @IsObject()
  deductions?: Record<string, number>;
}
