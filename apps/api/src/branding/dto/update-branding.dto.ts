import { IsOptional, IsString } from 'class-validator';

export class UpdateBrandingDto {
  @IsString()
  @IsOptional()
  appName?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  primaryColor?: string;

  @IsString()
  @IsOptional()
  secondaryColor?: string;
}
