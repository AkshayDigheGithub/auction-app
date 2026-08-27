import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
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

    // Surface the code in the response only when there's no real SMS provider,
    // so local development doesn't require reading API logs.
    return process.env.MSG91_API_KEY ? {} : { devCode: code };
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
      const existing = await this.prisma.db.user.findUnique({ where: { phoneNumber } });
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
