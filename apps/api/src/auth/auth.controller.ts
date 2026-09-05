import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyWidgetTokenDto } from './dto/verify-widget-token.dto';
import { VerifyClerkTokenDto } from './dto/verify-clerk-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phoneNumber);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(
      dto.phoneNumber,
      dto.code,
      dto.role,
      dto.name,
    );
  }

  /** MSG91 OTP widget: exchange its access token for one of our sessions. */
  @Post('widget/verify')
  verifyWidgetToken(@Body() dto: VerifyWidgetTokenDto) {
    return this.authService.verifyWidgetToken(
      dto.accessToken,
      dto.role,
      dto.name,
    );
  }

  /** Clerk sign-in: exchange a Clerk session token for one of ours (AUC-87). */
  @Post('clerk/verify')
  verifyClerkToken(@Body() dto: VerifyClerkTokenDto) {
    return this.authService.verifyClerkToken(
      dto.sessionToken,
      dto.role,
      dto.name,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
