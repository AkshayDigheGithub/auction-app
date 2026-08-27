import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

const VERIFY_URL = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';

interface VerifyResponse {
  type?: string;
  message?: unknown;
}

/**
 * Redeems the access token MSG91's OTP widget hands the browser.
 *
 * The widget verifies the OTP client-side and returns a signed JWT. That token
 * is the *only* trustworthy part of the exchange: the browser could claim any
 * phone number it likes, so the number is taken from MSG91's answer here and
 * never from the request body. Getting that backwards is an account takeover —
 * verify your own phone, post the token with someone else's number.
 */
@Injectable()
export class Msg91WidgetService {
  private readonly logger = new Logger('Msg91Widget');

  /** True when the widget flow is configured; otherwise callers fall back. */
  get isConfigured(): boolean {
    return Boolean(process.env.MSG91_API_KEY);
  }

  /**
   * @returns the verified phone number in E.164 form (`+91…`).
   * @throws UnauthorizedException if the token is rejected, or if MSG91's
   * answer contains no identifier we can pin the session to.
   */
  async verifyAccessToken(accessToken: string): Promise<string> {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authkey: process.env.MSG91_API_KEY,
        'access-token': accessToken,
      }),
    });

    const raw = await res.text();
    let parsed: VerifyResponse | null = null;
    try {
      parsed = JSON.parse(raw) as VerifyResponse;
    } catch {
      this.logger.error(`MSG91 returned a non-JSON body: ${raw}`);
      throw new UnauthorizedException('Could not verify this login');
    }

    // As elsewhere in MSG91's v5 API, failure arrives as HTTP 200 with
    // type:"error", so the status code alone proves nothing.
    if (!res.ok || parsed.type !== 'success') {
      this.logger.warn(`MSG91 rejected an access token: ${raw}`);
      throw new UnauthorizedException('Could not verify this login');
    }

    const identifier = this.extractIdentifier(parsed.message);
    if (!identifier) {
      // Fail closed. Without an identifier there is nothing tying this token to
      // a specific phone, so honouring it would mean trusting the browser's
      // claim — exactly the hole this endpoint exists to close.
      this.logger.error(
        `MSG91 verified a token but returned no usable identifier: ${raw}. ` +
          'Confirm the response field against a real MSG91 response before ' +
          'relying on this flow.',
      );
      throw new UnauthorizedException('Could not verify this login');
    }

    return identifier;
  }

  /**
   * MSG91 does not publish the shape of this response, so accept the documented
   * `message` string and the nested forms seen in the wild, and reject anything
   * that is not recognisably a phone number rather than guessing.
   *
   * The widget sends identifiers without a `+` (`919999…`); the rest of the app
   * stores E.164 (`+919999…`), so normalise here at the boundary.
   */
  private extractIdentifier(message: unknown): string | null {
    const candidate =
      typeof message === 'string'
        ? message
        : typeof message === 'object' && message !== null
          ? ((message as Record<string, unknown>).identifier ??
            (message as Record<string, unknown>).mobile ??
            (message as Record<string, unknown>).phone)
          : null;

    if (typeof candidate !== 'string') return null;

    const digits = candidate.replace(/[^\d]/g, '');
    // 10 national digits plus a 1-3 digit country code.
    if (digits.length < 11 || digits.length > 15) return null;

    return `+${digits}`;
  }
}
