import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { SalaryComponentCalcType, SalaryComponentType } from '@prisma/client';

export class CreateSalaryComponentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Stable key used in earnings/deductions maps, e.g. "TRANSPORT" */
  @IsString()
  @Matches(/^[A-Z0-9_]+$/)
  code!: string;

  @IsEnum(SalaryComponentType)
  type!: SalaryComponentType;

  @IsEnum(SalaryComponentCalcType)
  @IsOptional()
  calcType?: SalaryComponentCalcType;

  @IsBoolean()
  @IsOptional()
  isTaxable?: boolean;

  @IsNumber()
  @IsOptional()
  defaultAmount?: number;

  @IsNumber()
  @IsOptional()
  defaultRate?: number;
}
