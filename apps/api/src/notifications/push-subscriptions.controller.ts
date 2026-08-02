import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedRequestUser } from '../auth/types';
import { AppConfig } from '../config/configuration';

/** No @Roles() gating — any authenticated user manages only their own push subscriptions. */
@Controller('push-subscriptions')
export class PushSubscriptionsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * The VAPID public key is not a secret — it's handed to
   * PushManager.subscribe() client-side by design (RFC 8292) — so this is
   * safe to expose to any logged-in user without further gating.
   */
  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string | null } {
    const { publicKey } = this.configService.get('vapid', { infer: true });
    return { publicKey: publicKey ?? null };
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  subscribe(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: SubscribePushDto,
  ): Promise<void> {
    return this.notificationsService.subscribeToPush(
      user.tenantId,
      user.id,
      dto.endpoint,
      dto.keys,
      dto.userAgent,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UnsubscribePushDto,
  ): Promise<void> {
    return this.notificationsService.unsubscribeFromPush(user.id, dto.endpoint);
  }
}
