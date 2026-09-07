import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  createClerkClient,
  verifyToken,
  type ClerkClient,
} from '@clerk/backend';

/**
 * Redeems the session token Clerk issues to the browser (AUC-87).
 *
 * Same shape, and same reasoning, as Msg91WidgetService: the token is the only
 * trustworthy part of the exchange. The browser could claim any email address
 * it likes, so the address is resolved from Clerk here and never read off the
 * request body. Getting that backwards is an account takeover — sign in as
 * yourself, post the token with someone else's email.
 *
 * VerifyClerkTokenDto therefore has no email field at all.
 *
 * Clerk is the front door only. It proves who the user is once; the session
 * the app then runs on is our own 30-day JWT (see AuthService.issueSession).
 * That matters for a PWA on Indian mobile networks: Clerk's own tokens live
 * about a minute and need a live refresh, which is exactly the wrong property
 * for a shop owner opening the app on a bad connection.
 */
@Injectable()
export class ClerkAuthService {
  private readonly logger = new Logger('ClerkAuth');
  private client: ClerkClient | null = null;

  /** True when Clerk is configured; otherwise callers fall back. */
  get isConfigured(): boolean {
    return Boolean(process.env.CLERK_SECRET_KEY);
  }

  /**
   * Origins allowed to have minted the token. Without this, a token issued to
   * some other site running on the same Clerk instance is accepted here.
   * Unset means "don't check", which is fine for local development and wrong
   * for production — hence the warning at first use.
   */
  private authorizedParties(): string[] | undefined {
    const raw = process.env.CLERK_AUTHORIZED_PARTIES?.trim();
    if (!raw) return undefined;
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Built on first use rather than in the constructor. Nest instantiates
   * providers while ConfigModule may still be loading `.env`, so reading the
   * secret at construction time can capture an unset value and pin it for the
   * process — the same ordering trap that broke the Socket.io CORS allowlist
   * (see CorsIoAdapter in main.ts).
   */
  private clerk(secretKey: string): ClerkClient {
    if (!this.client) this.client = createClerkClient({ secretKey });
    return this.client;
  }

  /**
   * @returns the verified, lowercased primary email address.
   * @throws UnauthorizedException if the token is not a currently valid Clerk
   * session token, or the account behind it has no verified email.
   */
  async verifySessionToken(sessionToken: string): Promise<string> {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      // Fail closed. Without the secret there is no way to check the token's
      // signature, so honouring it would mean trusting whatever the browser
      // sent — exactly the hole this endpoint exists to close.
      this.logger.error(
        'CLERK_SECRET_KEY is not set — refusing to verify Clerk sign-ins. ' +
          'Set it to the secret key for the same Clerk instance the browser ' +
          'uses, or sign-in would accept any token at all.',
      );
      throw new UnauthorizedException('Sign-in is not configured');
    }

    const authorizedParties = this.authorizedParties();
    if (!authorizedParties) {
      this.logger.warn(
        'CLERK_AUTHORIZED_PARTIES is not set. A session token minted for a ' +
          'different site on this Clerk instance will be accepted here. Set ' +
          'it to this app’s origin(s) before taking real traffic.',
      );
    }

    let userId: string | undefined;
    try {
      // Verifies the signature against the instance's JWKS, the expiry, and —
      // when configured — that the token was minted for one of our origins.
      const claims = await verifyToken(sessionToken, {
        secretKey,
        authorizedParties,
      });
      userId = claims.sub;
    } catch (err) {
      this.logger.warn(
        `Clerk rejected a session token: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException('Could not verify this login');
    }

    if (!userId) {
      this.logger.warn('Clerk verified a token carrying no subject');
      throw new UnauthorizedException('Could not verify this login');
    }

    return this.verifiedEmailFor(userId, secretKey);
  }

  /**
   * Clerk's default session token carries no email address — only `sub`, `sid`
   * and friends. The address could be added via a JWT template, but that is
   * dashboard configuration this repository cannot see or test: if the
   * template is missing, renamed, or edited, sign-in breaks in production with
   * nothing in the diff to explain it. Asking the Backend API keeps the whole
   * contract in code, at the cost of one call per login — and logins are rare,
   * because the session it issues lasts 30 days.
   */
  private async verifiedEmailFor(
    userId: string,
    secretKey: string,
  ): Promise<string> {
    let user: Awaited<ReturnType<ClerkClient['users']['getUser']>>;
    try {
      user = await this.clerk(secretKey).users.getUser(userId);
    } catch (err) {
      this.logger.error(
        `Clerk verified a token but the user could not be fetched: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new UnauthorizedException('Could not verify this login');
    }

    // Clerk keeps banned and locked users signed in until their token expires,
    // so the token alone does not answer "may this person still use the app".
    if (user.banned || user.locked) {
      this.logger.warn(`Refused a session for a banned/locked user: ${userId}`);
      throw new UnauthorizedException('This account is not allowed to sign in');
    }

    const primary =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
      user.emailAddresses[0];

    if (!primary?.emailAddress) {
      this.logger.warn(`Clerk user ${userId} has no email address`);
      throw new UnauthorizedException('Could not verify this login');
    }

    // An address Clerk has not verified is one the user has not proven they
    // control. Honouring it lets someone sign up as an address belonging to
    // someone else and — because the session is keyed on email — take over
    // that account when its real owner later verifies it properly.
    if (primary.verification?.status !== 'verified') {
      this.logger.warn(
        `Clerk user ${userId} has an unverified primary email address`,
      );
      throw new UnauthorizedException(
        'Your account has no verified email address',
      );
    }

    // The column is unique and case-sensitive: normalising here stops one
    // person becoming two rows on an address that differs only in case.
    return primary.emailAddress.toLowerCase();
  }
}
