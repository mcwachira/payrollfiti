import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class AnalyticsQueryDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'periodFrom must be in YYYY-MM format',
  })
  periodFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'periodTo must be in YYYY-MM format' })
  periodTo?: string;
}
