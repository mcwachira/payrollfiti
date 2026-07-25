import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  leaveTypeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  /** Used only when the caller is ADMIN/HR creating a request on behalf of someone else */
  @IsString()
  @IsOptional()
  employeeId?: string;
}
