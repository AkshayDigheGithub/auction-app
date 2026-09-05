import { Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAuthService } from './google-auth.service';

/** A payload that passes every check, so each test can spoil exactly one thing. */
function goodPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: 'test-client-id.apps.googleusercontent.com',
    sub: '1234567890',
    email: 'shopkeeper@example.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function stubVerify(payload: unknown) {
  return jest
    .spyOn(OAuth2Client.prototype, 'verifyIdToken')
    .mockResolvedValue({ getPayload: () => payload } as never);
}

describe('GoogleAuthService.verifyIdToken', () => {
  const originalClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID =
      'test-client-id.apps.googleusercontent.com';
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalClientId === undefined)
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    else process.env.GOOGLE_OAUTH_CLIENT_ID = originalClientId;
  });

  it('returns the verified email address', async () => {
    stubVerify(goodPayload());
    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).resolves.toBe('shopkeeper@example.com');
  });

  it('lowercases the address so one account cannot become two rows', async () => {
    stubVerify(goodPayload({ email: 'ShopKeeper@Example.COM' }));
    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).resolves.toBe('shopkeeper@example.com');
  });

  it('pins the audience to our client id', async () => {
    // The check that stops a token minted for someone else's Google app from
    // being accepted as a login here.
    const spy = stubVerify(goodPayload());
    await new GoogleAuthService().verifyIdToken('a-token');

    expect(spy).toHaveBeenCalledWith({
      idToken: 'a-token',
      audience: 'test-client-id.apps.googleusercontent.com',
    });
  });

  it('fails closed when no client id is configured', async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    const spy = stubVerify(goodPayload());

    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).rejects.toThrow('Google sign-in is not configured');
    // Never verified at all — with no audience to pin, any token would pass.
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects an unverified email address', async () => {
    stubVerify(goodPayload({ email_verified: false }));
    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).rejects.toThrow('no verified email address');
  });

  it('rejects a payload whose issuer is not Google', async () => {
    stubVerify(goodPayload({ iss: 'https://accounts.evil.example' }));
    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
  });

  it('rejects a payload with no email address', async () => {
    const withoutEmail: Record<string, unknown> = goodPayload();
    delete withoutEmail.email;
    stubVerify(withoutEmail);
    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
  });

  it('rejects a token that verifies to no payload at all', async () => {
    stubVerify(undefined);
    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
  });

  it('turns a library rejection into a 401 rather than a 500', async () => {
    // Expired, tampered, or signed with a key Google no longer publishes.
    jest
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockRejectedValue(new Error('Token used too late') as never);

    await expect(
      new GoogleAuthService().verifyIdToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
  });

  it('reports whether it is configured', () => {
    expect(new GoogleAuthService().isConfigured).toBe(true);
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    expect(new GoogleAuthService().isConfigured).toBe(false);
  });
});
