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

/**
 * A verify-capable service: the dev-code suite above passes empty stubs
 * because requestOtp never touches the database or the signer.
 */
function makeVerifiableService(options: { failFirstUpsert?: boolean } = {}) {
  const sent: Array<{ phoneNumber: string; code: string }> = [];
  const otpProvider: OtpProvider = {
    sendOtp: (phoneNumber, code) => {
      sent.push({ phoneNumber, code });
      return Promise.resolve();
    },
  };

  let upserts = 0;
  const prisma = {
    db: {
      user: {
        findUnique: () => Promise.resolve(null),
        upsert: ({ where, create }: { where: { phoneNumber: string }; create: { role: string; name?: string } }) => {
          upserts += 1;
          if (options.failFirstUpsert && upserts === 1) {
            // What Neon does to a pooled connection that has gone idle.
            return Promise.reject(new Error("Connection terminated unexpectedly"));
          }
          return Promise.resolve({
            id: "user-1",
            phoneNumber: where.phoneNumber,
            role: create.role,
            name: create.name ?? null,
          });
        },
      },
    },
  } as unknown as PrismaService;

  const jwtService = { sign: () => "signed-token" } as unknown as JwtService;

  const service = new AuthService(prisma, jwtService, otpProvider, {} as Msg91WidgetService);
  return { service, sent };
}

describe("AuthService.verifyOtp — when the code is consumed", () => {
  it("issues a session and consumes the code exactly once", async () => {
    const { service, sent } = makeVerifiableService();
    await service.requestOtp("+919876543210");
    const { code } = sent[0];

    const res = await service.verifyOtp("+919876543210", code, "customer");
    expect(res.token).toBe("signed-token");

    // Replay must fail: the code is single-use on the success path.
    await expect(service.verifyOtp("+919876543210", code, "customer")).rejects.toThrow(
      "Invalid or expired OTP",
    );
  });

  it("leaves the code usable when issuing the session fails", async () => {
    // The bug this guards: a dropped database connection burned the code, so
    // the retry with the code still on screen reported "Invalid or expired
    // OTP" — pointing at the OTP instead of at the real failure.
    const { service, sent } = makeVerifiableService({ failFirstUpsert: true });
    await service.requestOtp("+919876543210");
    const { code } = sent[0];

    await expect(service.verifyOtp("+919876543210", code, "customer")).rejects.toThrow(
      "Connection terminated unexpectedly",
    );

    const res = await service.verifyOtp("+919876543210", code, "customer");
    expect(res.token).toBe("signed-token");
  });

  it("still rejects a wrong code, and leaves the real one usable", async () => {
    const { service, sent } = makeVerifiableService();
    await service.requestOtp("+919876543210");
    const { code } = sent[0];

    await expect(service.verifyOtp("+919876543210", "000000", "customer")).rejects.toThrow(
      "Invalid or expired OTP",
    );
    await expect(service.verifyOtp("+919876543210", code, "customer")).resolves.toMatchObject({
      token: "signed-token",
    });
  });
});
