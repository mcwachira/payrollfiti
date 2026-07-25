import { IsOptional, IsString } from 'class-validator';

export class PayoffLoanDto {
  @IsString()
  @IsOptional()
  note?: string;
}
