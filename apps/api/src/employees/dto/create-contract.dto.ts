import { IsDateString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class CreateContractDto {
  @IsEnum(EmploymentType)
  type!: EmploymentType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsObject()
  @IsOptional()
  terms?: Record<string, unknown>;
}
