import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentProviderType } from '@prisma/client';

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  planCode!: string;

  @IsEnum(PaymentProviderType)
  @IsOptional()
  provider?: PaymentProviderType;
}
