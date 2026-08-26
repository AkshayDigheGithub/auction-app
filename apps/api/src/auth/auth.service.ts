import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OTP_PROVIDER, type OtpProvider } from './otp-provider.interface';

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
