import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSalaryStructureDto {
  @IsNumber()
  @Min(0)
  basicSalary!: number;

  @IsObject()
  @IsOptional()
  allowances?: Record<string, number>;

  @IsString()
  currency!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
