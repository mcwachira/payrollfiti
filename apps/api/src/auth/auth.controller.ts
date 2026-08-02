import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, SessionMeta } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorEnableDto } from './dto/two-factor-enable.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh.guard';
import { AuthenticatedRequestUser } from './types';

/** Where a Session actually originated — captured once, at the HTTP layer,
 *  never trusted from a request body. */
function sessionMeta(req: Request): SessionMeta {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.authService.signup(dto, sessionMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, sessionMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('accept-invite')
  acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request) {
    return this.authService.acceptInvite(dto, sessionMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto, sessionMeta(req));
  }

  @Get('2fa/status')
  twoFactorStatus(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.getTwoFactorStatus(user.id);
  }

  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.setupTwoFactor(user.id);
  }

  @Post('2fa/enable')
  enableTwoFactor(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: TwoFactorEnableDto,
  ) {
    return this.authService.enableTwoFactor(user.id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('2fa/disable')
  disableTwoFactor(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: TwoFactorDisableDto,
  ) {
    return this.authService.disableTwoFactor(user.id, dto);
  }

  // Public — the user isn't authenticated yet at this point in the login
  // flow; the short-lived challengeToken from login() is what's verified
  // instead (see AuthService.verifyTwoFactor).
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/verify')
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto, @Req() req: Request) {
    return this.authService.verifyTwoFactor(dto, sessionMeta(req));
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(
    @CurrentUser()
    user: {
      userId: string;
      sessionId: string;
      refreshToken: string;
    },
  ) {
    return this.authService.refresh(
      user.userId,
      user.sessionId,
      user.refreshToken,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.logout(user.id, user.sessionId);
  }

  // "Signed-in devices" — every Session for the current user, not just the
  // one making this request.
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  // "Sign out this device" — revoking the CURRENT session works too (the
  // access token stays valid until it naturally expires, but refresh will
  // fail from that point on), same tradeoff logout() already has.
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  revokeSession(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
  ) {
    return this.authService.revokeSession(user.id, id);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return user;
  }
}
