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

interface PendingOtp {
  code: string;
  expiresAt: number;
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
    this.pending.delete(phoneNumber);

    return this.issueSession(phoneNumber, role, name);
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
    return this.issueSession(phoneNumber, role, name);
  }

  /**
   * Everything after "this phone number is proven": the admin self-signup
   * guard, the user record, and the session token. Shared so the two
   * verification paths cannot drift on who is allowed to become an admin.
   */
  private async issueSession(
    phoneNumber: string,
    role: 'customer' | 'shop_owner' | 'admin',
    name?: string,
  ) {
    if (role === 'admin') {
      const existing = await this.prisma.db.user.findUnique({
        where: { phoneNumber },
      });
      if (!existing || existing.role !== 'admin') {
        throw new ForbiddenException(
          'Admin accounts cannot self-register — ask an existing admin to grant this role directly in the database.',
        );
      }
    }

    const user = await this.prisma.db.user.upsert({
      where: { phoneNumber },
      update: {},
      create: { phoneNumber, role, name },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    });

    return { token, user };
  }
}
