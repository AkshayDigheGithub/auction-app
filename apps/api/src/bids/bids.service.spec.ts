import { NotFoundException } from '@nestjs/common';
import { BidsService } from './bids.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { BidCache } from '../realtime/bid-cache.interface';
import type { PricingService } from '../pricing/pricing.service';

const OWNER = 'user_owner';
const STRANGER = 'user_stranger';

/**
 * Drives `listBids` with a request owned by OWNER. The cache is primed by
 * default so the tests below prove authorisation runs *before* the cache is
 * consulted — a cache hit must not be a way around the ownership check.
 */
function makeService(opts: { requestExists?: boolean; cached?: unknown[] | null } = {}) {
  const { requestExists = true, cached = [{ id: 'bid_cached' }] } = opts;

  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    db: {
      request: {
        findUnique: jest
          .fn()
          .mockResolvedValue(requestExists ? { customerUserId: OWNER } : null),
      },
      bid: { findMany },
    },
  } as unknown as PrismaService;

  const bidCache = {
    getBids: jest.fn().mockResolvedValue(cached),
    setBids: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
  } as unknown as BidCache;

  const service = new BidsService(
    prisma,
    {} as RealtimeGateway,
    bidCache,
    {} as PricingService,
  );

  return { service, prisma, bidCache, findMany };
}

describe('BidsService.listBids', () => {
  it('returns the bid list to the customer who posted the request', async () => {
    const { service } = makeService();
    await expect(service.listBids('req_1', OWNER)).resolves.toEqual([
      { id: 'bid_cached' },
    ]);
  });

  /**
   * The one that matters: blind bidding is a property the marketing site states
   * publicly, and before the ownership check it was enforced only by the shop
   * UI declining to render the list. Anyone authenticated could read a rival's
   * prices straight from the API.
   */
  it('hides the bid list from anyone other than the request owner', async () => {
    const { service } = makeService();
    await expect(service.listBids('req_1', STRANGER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('does not serve a cached list to a stranger', async () => {
    const { service, bidCache } = makeService();
    await expect(service.listBids('req_1', STRANGER)).rejects.toThrow();
    expect(bidCache.getBids).not.toHaveBeenCalled();
  });

  // Not-found rather than forbidden on purpose: a distinct "exists but is not
  // yours" would confirm a valid request id to someone guessing.
  it('reports a missing request the same way as someone else’s request', async () => {
    const missing = makeService({ requestExists: false });
    const notMine = makeService();

    const a = await missing.service.listBids('req_x', OWNER).catch((e: Error) => e);
    const b = await notMine.service.listBids('req_1', STRANGER).catch((e: Error) => e);

    expect((a as Error).constructor).toBe((b as Error).constructor);
    expect((a as Error).message).toBe((b as Error).message);
  });

  it('queries the database when the cache is empty', async () => {
    const { service, findMany } = makeService({ cached: null });
    await service.listBids('req_1', OWNER);
    expect(findMany).toHaveBeenCalled();
  });

  it('never selects a shop’s wallet, UPI or owner fields', async () => {
    const { service, findMany } = makeService({ cached: null });
    await service.listBids('req_1', OWNER);

    const shopSelect = findMany.mock.calls[0][0].include.shop.select;
    expect(shopSelect).toEqual({ id: true, shopName: true, verified: true });
    for (const leaked of [
      'walletBalancePaise',
      'upiId',
      'gstNumber',
      'ownerUserId',
      'suspendedReason',
    ]) {
      expect(shopSelect).not.toHaveProperty(leaked);
    }
  });
});
