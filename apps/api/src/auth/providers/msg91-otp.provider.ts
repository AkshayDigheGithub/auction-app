import { Injectable, Logger } from '@nestjs/common';
import type { OtpProvider } from '../otp-provider.interface';

/**
 * MSG91 SMS delivery (AUC-31). Wired up but only used when MSG91_API_KEY is
 * set — see auth.module.ts for the provider selection.
 */
@Injectable()
export class Msg91OtpProvider implements OtpProvider {
  private readonly logger = new Logger('OTP');

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const apiKey = process.env.MSG91_API_KEY;
    const senderId = process.env.MSG91_SENDER_ID || 'OTPSMS';

    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: apiKey as string,
      },
      body: JSON.stringify({
        mobile: phoneNumber,
        otp: code,
        sender: senderId,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`MSG91 send failed (${res.status}): ${body}`);
      throw new Error('Failed to send OTP via MSG91');
    }
  }
}
