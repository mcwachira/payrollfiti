import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Query,
  Redirect,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountingProviderType } from '@prisma/client';
import { AccountingIntegrationsService } from './accounting-integrations.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuthenticatedRequestUser } from '../auth/types';
import { AppConfig } from '../config/configuration';

@Controller('accounting/integrations')
export class AccountingIntegrationsController {
  constructor(
    private readonly integrationsService: AccountingIntegrationsService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Roles(Role.ADMIN)
  @Get()
  listStatus(@CurrentTenant() tenantId: string) {
    return this.integrationsService.listStatus(tenantId);
  }

  @Roles(Role.ADMIN)
  @Get(':provider/connect')
  async connect(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('provider', new ParseEnumPipe(AccountingProviderType))
    provider: AccountingProviderType,
  ) {
    const authorizeUrl = await this.integrationsService.getAuthorizeUrl(
      tenantId,
      user.id,
      provider,
    );
    return { authorizeUrl };
  }

  // Public: this is where QuickBooks/Xero/Zoho Books redirect the user's
  // BROWSER back to after they approve access — no Authorization header is
  // present, since it's a plain navigation, not an XHR call from our own
  // frontend. The signed `state` param (see getAuthorizeUrl) is what
  // proves the request is legitimate instead.
  @Public()
  @Get('callback/:provider')
  @Redirect()
  async callback(
    @Param('provider', new ParseEnumPipe(AccountingProviderType))
    provider: AccountingProviderType,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const corsOrigin = this.configService.get('corsOrigin', { infer: true });
    try {
      await this.integrationsService.handleCallback(
        provider,
        code,
        state,
        query,
      );
      return {
        url: `${corsOrigin}/settings?accounting=connected&provider=${provider}`,
      };
    } catch {
      return {
        url: `${corsOrigin}/settings?accounting=error&provider=${provider}`,
      };
    }
  }

  @Roles(Role.ADMIN)
  @Delete(':provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @CurrentTenant() tenantId: string,
    @Param('provider', new ParseEnumPipe(AccountingProviderType))
    provider: AccountingProviderType,
  ) {
    return this.integrationsService.disconnect(tenantId, provider);
  }
}
