import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

/** Google's two accepted `iss` values. Anything else is not a Google token. */
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Redeems the ID token Google Identity Services hands the browser (AUC-87).
 *
 * Same shape, and same reasoning, as Msg91WidgetService: the token is the only
 * trustworthy part of the exchange. The browser could claim any email address
 * it likes, so the address is taken from Google's signed payload here and never
 * from the request body. Getting that backwards is an account takeover — sign
 * in as yourself, post the token with someone else's email.
 *
 * VerifyGoogleTokenDto therefore has no email field at all.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger('GoogleAuth');
  private client: OAuth2Client | null = null;

  /** True when Google sign-in is configured; otherwise callers fall back. */
  get isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID);
  }

  /**
   * Built on first use rather than in the constructor. Nest instantiates
   * providers while ConfigModule may still be loading `.env`, so reading the
   * client id at construction time can capture an unset value and pin it for
   * the process — the same ordering trap that broke the Socket.io CORS
   * allowlist (see CorsIoAdapter in main.ts).
   */
  private oauthClient(): OAuth2Client {
    if (!this.client) this.client = new OAuth2Client();
    return this.client;
  }

  /**
   * @returns the verified, lowercased email address.
   * @throws UnauthorizedException if the token is not a currently valid Google
   * token issued to *this* app, or carries no verified email.
   */
  async verifyIdToken(idToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      // Fail closed. With no client id there is no audience to pin the token
      // to, so any Google token for any app would otherwise be accepted —
      // including one issued to an app the attacker controls.
      this.logger.error(
        'GOOGLE_OAUTH_CLIENT_ID is not set — refusing to verify Google sign-ins. ' +
          'Set it to the same client id the browser uses, or Google sign-in ' +
          'would accept tokens minted for any other application.',
      );
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    let payload: TokenPayload | undefined;
    try {
      // Checks the signature against Google's rotating public keys, that `aud`
      // is our client id, and that the token has not expired.
      const ticket = await this.oauthClient().verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(
        `Google rejected an ID token: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException('Could not verify this login');
    }

    if (!payload) {
      this.logger.warn('Google verified an ID token but returned no payload');
      throw new UnauthorizedException('Could not verify this login');
    }

    // The library already checks the issuer, but assert it here too: this is
    // the claim that says the signature we just trusted came from Google at
    // all, and it is one library upgrade away from being someone else's
    // default. Cheap to state, expensive to discover missing.
    if (!GOOGLE_ISSUERS.includes(payload.iss)) {
      this.logger.warn(
        `Google ID token had an unexpected issuer: ${payload.iss}`,
      );
      throw new UnauthorizedException('Could not verify this login');
    }

    // Google will happily mint a token for an account whose email it has not
    // verified. Honouring one lets someone sign up with an address they do not
    // control, and — because the session is keyed on email — take over the
    // account of whoever later verifies it properly.
    if (payload.email_verified !== true) {
      this.logger.warn('Google ID token carried an unverified email address');
      throw new UnauthorizedException(
        'Your Google account has no verified email address',
      );
    }

    if (!payload.email) {
      this.logger.warn('Google ID token carried no email address');
      throw new UnauthorizedException('Could not verify this login');
    }

    // Google addresses are case-insensitive and it returns them already
    // lowercased, but the column is unique and case-sensitive: normalising here
    // stops one person becoming two rows on a token that differs only in case.
    return payload.email.toLowerCase();
  }
}
