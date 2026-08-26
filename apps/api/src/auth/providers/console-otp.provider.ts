import { Injectable, Logger } from '@nestjs/common';
import type { OtpProvider } from '../otp-provider.interface';

/** Dev-mode OTP delivery: logs the code instead of sending a real SMS. */
@Injectable()
export class ConsoleOtpProvider implements OtpProvider {
  private readonly logger = new Logger('OTP');

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    this.logger.warn(`[DEV] OTP for ${phoneNumber}: ${code} (MSG91_API_KEY not set — no real SMS sent)`);
  }
}
