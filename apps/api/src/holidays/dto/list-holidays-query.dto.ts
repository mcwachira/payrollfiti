import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListHolidaysQueryDto {
  /** ISO-3166 alpha-2 country code, e.g. "KE" */
  @IsString()
  country!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
