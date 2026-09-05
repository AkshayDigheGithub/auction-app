import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OTP_PROVIDER, type OtpProvider } from './otp-provider.interface';
import { Msg91WidgetService } from './msg91-widget.service';
import { GoogleAuthService } from './google-auth.service';

interface PendingOtp {
  code: string;
  expiresAt: number;
}

/**
 * How a caller proved who they are: a phone number (our OTP or MSG91's) or an
 * email address (a Google ID token). Both are already verified by the time they
 * reach issueSession — it never checks a credential, it only decides which
 * unique column to key the user on.
 */
type Identity =
  { kind: 'phone'; phoneNumber: string } | { kind: 'email'; email: string };

/**
 * The unique-column lookup for an identity. Shared by the admin guard and the
 * upsert below so the row we check can never be a different row from the one we
 * then sign a session for.
 */
function identityWhere(identity: Identity) {
  return identity.kind === 'phone'
    ? { phoneNumber: identity.phoneNumber }
    : { email: identity.email };
}

const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * Whether to hand the OTP back in the API response.
 *
 * This is opt-in and defaults to off, because the previous rule — return it
 * unless MSG91_API_KEY is set — inferred a security property from an unrelated
 * setting, and so failed *open*. Production ran with no MSG91 key, which meant
 * anyone could request a code for any phone number, read it out of the
 * response and sign in as that person, administrators included.
 *
 * Deliberately not keyed on NODE_ENV: it is unset in this deployment, so a
 * `NODE_ENV === 'production'` guard would have failed open in exactly the same
 * way. An explicit variable cannot be true by accident.
 */
function devCodeExposureEnabled(): boolean {
  return process.env.EXPOSE_DEV_OTP === 'true';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Ephemeral by design — OTPs aren't part of the durable schema (spec §7).
  // Fine for a single API instance; move to Redis if you scale out horizontally.
  private readonly pending = new Map<string, PendingOtp>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(OTP_PROVIDER) private readonly otpProvider: OtpProvider,
    private readonly msg91Widget: Msg91WidgetService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  async requestOtp(phoneNumber: string): Promise<{ devCode?: string }> {
    const code = String(randomInt(100000, 999999));
    this.pending.set(phoneNumber, { code, expiresAt: Date.now() + OTP_TTL_MS });
    await this.otpProvider.sendOtp(phoneNumber, code);

    if (!devCodeExposureEnabled()) return {};

    // Loud, and on every request rather than once at boot, so this cannot sit
    // unnoticed in a deployment that is taking real traffic.
    this.logger.error(
      'EXPOSE_DEV_OTP is on: returning the OTP in the API response. Anyone ' +
        'who can reach this endpoint can sign in as any user. Never leave ' +
        'this set on a deployment the public can reach.',
    );
    return { devCode: code };
  }

  async verifyOtp(
    phoneNumber: string,
    code: string,
    role: 'customer' | 'shop_owner' | 'admin',
    name?: string,
  ) {
    const entry = this.pending.get(phoneNumber);
    if (!entry || entry.expiresAt < Date.now() || entry.code !== code) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    // Consume the code only once a session actually came back. Deleting it
    // first meant any failure inside issueSession — a dropped database
    // connection is the common one — burned the code, so the retry the user
    // naturally makes with the code still on their screen returned "Invalid
    // or expired OTP" and sent them looking for a bug in the OTP itself.
    // A wrong code is already rejected above, so this does not widen guessing.
    const session = await this.issueSession(
      { kind: 'phone', phoneNumber },
      role,
      name,
    );
    this.pending.delete(phoneNumber);
    return session;
  }

  /**
   * Widget flow (MSG91 "Login with OTP"): the browser sends only the access
   * token MSG91 issued. The phone number comes back from MSG91 and is never
   * read off the request — see Msg91WidgetService for why that matters.
   */
  async verifyWidgetToken(
    accessToken: string,
    role: 'customer' | 'shop_owner' | 'admin',
    name?: string,
  ) {
    const phoneNumber = await this.msg91Widget.verifyAccessToken(accessToken);
    return this.issueSession({ kind: 'phone', phoneNumber }, role, name);
  }

  /**
   * Google flow: the browser sends only the ID token Google issued. The email
   * comes back from Google's verified payload and is never read off the
   * request — see GoogleAuthService for why that matters.
   */
  async verifyGoogleToken(
    idToken: string,
    role: 'customer' | 'shop_owner' | 'admin',
    name?: string,
  ) {
    const email = await this.googleAuth.verifyIdToken(idToken);
    return this.issueSession({ kind: 'email', email }, role, name);
  }

  /**
   * Everything after "this phone number is proven": the admin self-signup
   * guard, the user record, and the session token. Shared so the two
   * verification paths cannot drift on who is allowed to become an admin.
   */
  private async issueSession(
    identity: Identity,
    role: 'customer' | 'shop_owner' | 'admin',
    name?: string,
  ) {
    const where = identityWhere(identity);

    if (role === 'admin') {
      const existing = await this.prisma.db.user.findUnique({ where });
      if (!existing || existing.role !== 'admin') {
        throw new ForbiddenException(
          'Admin accounts cannot self-register — ask an existing admin to grant this role directly in the database.',
        );
      }
    }

    const user = await this.prisma.db.user.upsert({
      where,
      update: {},
      create: { ...where, role, name },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }
}
