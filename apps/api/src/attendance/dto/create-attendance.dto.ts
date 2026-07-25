import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class CreateAttendanceDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
