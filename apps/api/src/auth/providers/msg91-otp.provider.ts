import { Injectable, Logger } from '@nestjs/common';
import type { OtpProvider } from '../otp-provider.interface';

/**
 * Shape of the MSG91 v5 response we care about. It reports failure in the
 * body, not the status code, so this has to be inspected either way.
 */
interface Msg91Response {
  type?: string;
  message?: string;
  request_id?: string;
}

/**
 * MSG91 SMS delivery (AUC-31). Only used when MSG91_API_KEY is set — see
 * auth.module.ts for provider selection.
 *
 * Indian commercial SMS goes through DLT (TRAI's TCCCPR rules), which means
 * three things have to line up before a single message is delivered:
 *
 *   - the sender header is registered to your Principal Entity,
 *   - the message body matches an approved content template exactly, apart
 *     from its variables, and
 *   - your Principal Entity is chain-bound to MSG91 as your Telemarketer.
 *
 * `MSG91_TEMPLATE_ID` is the approved template. Sending without it is rejected
 * outright, so this fails fast with a message naming the cause rather than
 * letting it surface as "the OTP never arrived".
 */
@Injectable()
export class Msg91OtpProvider implements OtpProvider {
  private readonly logger = new Logger('OTP');

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const apiKey = process.env.MSG91_API_KEY;
    const senderId = process.env.MSG91_SENDER_ID || 'OTPSMS';
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!templateId) {
      throw new Error(
        'MSG91_TEMPLATE_ID is not set. DLT requires an approved content ' +
          'template for every commercial SMS in India; MSG91 rejects OTP ' +
          'sends without one.',
      );
    }

    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: apiKey as string,
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: phoneNumber,
        otp: code,
        sender: senderId,
      }),
    });

    const raw = await res.text();

    if (!res.ok) {
      this.logger.error(`MSG91 send failed (${res.status}): ${raw}`);
      throw new Error('Failed to send OTP via MSG91');
    }

    // MSG91 answers 200 with {"type":"error"} for most real failures —
    // an unbound PE-TM chain, an unapproved header, a template mismatch.
    // Trusting the status code alone reports a delivered OTP that was never
    // sent, which presents to the user as a code that never arrives and
    // leaves nothing in the logs to explain it.
    let parsed: Msg91Response | null = null;
    try {
      parsed = JSON.parse(raw) as Msg91Response;
    } catch {
      this.logger.error(`MSG91 returned a non-JSON body: ${raw}`);
      throw new Error('Failed to send OTP via MSG91');
    }

    if (parsed.type !== 'success') {
      this.logger.error(
        `MSG91 rejected the send: ${parsed.message ?? raw}. Common causes: ` +
          'the PE-TM chain is not bound on DLT, the sender header is not ' +
          'approved, or the message does not match the approved template.',
      );
      throw new Error('Failed to send OTP via MSG91');
    }
  }
}
