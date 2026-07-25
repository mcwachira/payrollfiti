import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCorrectionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsNumber()
  @Min(0)
  basicSalary!: number;

  @IsObject()
  @IsOptional()
  allowances?: Record<string, number>;

  @IsNumber()
  @IsOptional()
  overtimeAmount?: number;

  @IsNumber()
  @IsOptional()
  commissionAmount?: number;

  @IsNumber()
  @IsOptional()
  bonusAmount?: number;
}
