import { Logger } from '@nestjs/common';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
  createClerkClient: jest.fn(),
}));

import { createClerkClient, verifyToken } from '@clerk/backend';
import { ClerkAuthService } from './clerk-auth.service';

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockCreateClerkClient = createClerkClient as jest.MockedFunction<
  typeof createClerkClient
>;

/** A Clerk user that passes every check, so each test can spoil exactly one thing. */
function clerkUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user_abc123',
    banned: false,
    locked: false,
    primaryEmailAddressId: 'idn_primary',
    emailAddresses: [
      {
        id: 'idn_primary',
        emailAddress: 'shopkeeper@example.com',
        verification: { status: 'verified' },
      },
    ],
    ...overrides,
  };
}

/** Wires both Clerk calls: token verification, then the user lookup. */
function stubClerk(options: { sub?: string | null; user?: unknown } = {}) {
  mockVerifyToken.mockResolvedValue({
    sub: options.sub === undefined ? 'user_abc123' : options.sub,
  } as never);

  const getUser = jest.fn().mockResolvedValue(options.user ?? clerkUser());
  mockCreateClerkClient.mockReturnValue({ users: { getUser } } as never);
  return { getUser };
}

describe('ClerkAuthService.verifySessionToken', () => {
  const originalSecret = process.env.CLERK_SECRET_KEY;
  const originalParties = process.env.CLERK_AUTHORIZED_PARTIES;

  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_notarealkey';
    delete process.env.CLERK_AUTHORIZED_PARTIES;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockVerifyToken.mockReset();
    mockCreateClerkClient.mockReset();
    if (originalSecret === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalSecret;
    if (originalParties === undefined)
      delete process.env.CLERK_AUTHORIZED_PARTIES;
    else process.env.CLERK_AUTHORIZED_PARTIES = originalParties;
  });

  it('returns the verified primary email address', async () => {
    stubClerk();
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).resolves.toBe('shopkeeper@example.com');
  });

  it('lowercases the address so one account cannot become two rows', async () => {
    stubClerk({
      user: clerkUser({
        emailAddresses: [
          {
            id: 'idn_primary',
            emailAddress: 'ShopKeeper@Example.COM',
            verification: { status: 'verified' },
          },
        ],
      }),
    });
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).resolves.toBe('shopkeeper@example.com');
  });

  it('takes the primary address, not merely the first', async () => {
    stubClerk({
      user: clerkUser({
        primaryEmailAddressId: 'idn_second',
        emailAddresses: [
          {
            id: 'idn_first',
            emailAddress: 'old@example.com',
            verification: { status: 'verified' },
          },
          {
            id: 'idn_second',
            emailAddress: 'current@example.com',
            verification: { status: 'verified' },
          },
        ],
      }),
    });
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).resolves.toBe('current@example.com');
  });

  it('restricts the token to our own origins when configured', async () => {
    // What stops a token minted for another site on the same Clerk instance
    // from being replayed here.
    process.env.CLERK_AUTHORIZED_PARTIES =
      'https://a.example, https://b.example';
    stubClerk();

    await new ClerkAuthService().verifySessionToken('a-token');

    expect(mockVerifyToken).toHaveBeenCalledWith('a-token', {
      secretKey: 'sk_test_notarealkey',
      authorizedParties: ['https://a.example', 'https://b.example'],
    });
  });

  it('fails closed when no secret key is configured', async () => {
    delete process.env.CLERK_SECRET_KEY;
    stubClerk();

    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('Sign-in is not configured');
    // Never verified at all — without the secret there is nothing to check.
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('rejects a banned user', async () => {
    // Clerk leaves a banned user signed in until their token expires, so the
    // token alone does not answer "may this person still use the app".
    stubClerk({ user: clerkUser({ banned: true }) });
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('not allowed to sign in');
  });

  it('rejects a locked user', async () => {
    stubClerk({ user: clerkUser({ locked: true }) });
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('not allowed to sign in');
  });

  it('rejects an unverified primary email address', async () => {
    stubClerk({
      user: clerkUser({
        emailAddresses: [
          {
            id: 'idn_primary',
            emailAddress: 'unproven@example.com',
            verification: { status: 'unverified' },
          },
        ],
      }),
    });
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('no verified email address');
  });

  it('rejects a user with no email address at all', async () => {
    stubClerk({ user: clerkUser({ emailAddresses: [] }) });
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
  });

  it('rejects a token carrying no subject', async () => {
    const { getUser } = stubClerk({ sub: null });
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
    expect(getUser).not.toHaveBeenCalled();
  });

  it('turns a rejected token into a 401 rather than a 500', async () => {
    // Expired, tampered, or minted for a different Clerk instance.
    mockVerifyToken.mockRejectedValue(new Error('token-invalid'));
    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
  });

  it('turns a failed user lookup into a 401 rather than a 500', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_abc123' } as never);
    mockCreateClerkClient.mockReturnValue({
      users: { getUser: jest.fn().mockRejectedValue(new Error('503')) },
    } as never);

    await expect(
      new ClerkAuthService().verifySessionToken('a-token'),
    ).rejects.toThrow('Could not verify this login');
  });

  it('reports whether it is configured', () => {
    expect(new ClerkAuthService().isConfigured).toBe(true);
    delete process.env.CLERK_SECRET_KEY;
    expect(new ClerkAuthService().isConfigured).toBe(false);
  });
});
