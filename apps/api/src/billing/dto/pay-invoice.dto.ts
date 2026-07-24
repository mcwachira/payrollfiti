import { IsOptional, IsString } from 'class-validator';

export class PayInvoiceDto {
  /** Required when the tenant's subscription provider is M-Pesa */
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
