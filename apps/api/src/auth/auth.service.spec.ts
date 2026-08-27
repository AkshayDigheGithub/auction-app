import { Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OtpProvider } from './otp-provider.interface';
import type { Msg91WidgetService } from './msg91-widget.service';
import type { JwtService } from '@nestjs/jwt';

function makeService() {
  const sent: Array<{ phoneNumber: string; code: string }> = [];
  const otpProvider: OtpProvider = {
    sendOtp: (phoneNumber, code) => {
      sent.push({ phoneNumber, code });
      return Promise.resolve();
    },
  };

  const service = new AuthService(
    {} as PrismaService,
    {} as JwtService,
    otpProvider,
    {} as Msg91WidgetService,
  );
  return { service, sent };
}

describe('AuthService.requestOtp — dev code exposure (AUC-43)', () => {
  const original = process.env.EXPOSE_DEV_OTP;
  const originalKey = process.env.MSG91_API_KEY;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (original === undefined) delete process.env.EXPOSE_DEV_OTP;
    else process.env.EXPOSE_DEV_OTP = original;
    if (originalKey === undefined) delete process.env.MSG91_API_KEY;
    else process.env.MSG91_API_KEY = originalKey;
  });

  it('never returns the code by default', async () => {
    // The regression that mattered: production had no MSG91 key and no
    // NODE_ENV, and the old rule handed the OTP to anyone who asked.
    delete process.env.EXPOSE_DEV_OTP;
    delete process.env.MSG91_API_KEY;

    const { service, sent } = makeService();
    const res = await service.requestOtp('+919876543210');

    expect(res).toEqual({});
    expect(res.devCode).toBeUndefined();
    // The code is still generated and delivered — just not echoed back.
    expect(sent).toHaveLength(1);
    expect(sent[0].code).toMatch(/^\d{6}$/);
  });

  it('does not expose the code merely because SMS is unconfigured', async () => {
    delete process.env.MSG91_API_KEY;
    process.env.EXPOSE_DEV_OTP = 'false';

    const { service } = makeService();
    await expect(service.requestOtp('+919876543210')).resolves.toEqual({});
  });

  it('returns the code only on an explicit opt-in', async () => {
    process.env.EXPOSE_DEV_OTP = 'true';

    const { service, sent } = makeService();
    const res = await service.requestOtp('+919876543210');

    expect(res.devCode).toBe(sent[0].code);
  });

  it('treats any value other than "true" as off', async () => {
    // Guards against a truthy-string bug: "1", "yes" and friends must not
    // silently switch this on.
    for (const value of ['1', 'yes', 'TRUE', 'on', '']) {
      process.env.EXPOSE_DEV_OTP = value;
      const { service } = makeService();
      await expect(service.requestOtp('+919876543210')).resolves.toEqual({});
    }
  });
});
