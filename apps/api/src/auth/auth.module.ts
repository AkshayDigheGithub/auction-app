import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OTP_PROVIDER } from './otp-provider.interface';
import { Msg91WidgetService } from './msg91-widget.service';
import { GoogleAuthService } from './google-auth.service';
import { ConsoleOtpProvider } from './providers/console-otp.provider';
import { Msg91OtpProvider } from './providers/msg91-otp.provider';
import { SharedJwtModule } from '../common/shared-jwt.module';

@Module({
  imports: [SharedJwtModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    Msg91WidgetService,
    GoogleAuthService,
    ConsoleOtpProvider,
    Msg91OtpProvider,
    {
      provide: OTP_PROVIDER,
      useFactory: (msg91: Msg91OtpProvider, dev: ConsoleOtpProvider) =>
        process.env.MSG91_API_KEY ? msg91 : dev,
      inject: [Msg91OtpProvider, ConsoleOtpProvider],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
