import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('accept-invite')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
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
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
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
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
    return this.authService.verifyTwoFactor(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@CurrentUser() user: { userId: string; refreshToken: string }) {
    return this.authService.refresh(user.userId, user.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return user;
  }
}
