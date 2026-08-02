import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';

class PushSubscriptionKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

/** Mirrors the browser's PushSubscription.toJSON() shape. */
export class SubscribePushDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

  @IsString()
  @IsOptional()
  userAgent?: string;
}
