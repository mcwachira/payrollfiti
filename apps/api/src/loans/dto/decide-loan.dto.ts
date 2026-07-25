import { IsIn, IsOptional, IsString } from 'class-validator';

export class DecideLoanDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  reason?: string;
}
