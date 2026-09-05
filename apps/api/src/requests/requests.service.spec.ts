import { Logger } from '@nestjs/common';
import { RequestsService } from './requests.service';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  GeoService,
  NearbyShop,
  ShopExclusionReason,
  ShopMatchResult,
} from '../geo/geo.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { PushService } from '../push/push.service';
import type { GeocodingProvider } from '../geo/geocoding-provider.interface';

function shop(id: string): NearbyShop {
  return {
    id,
    shop_name: id,
    address: 'somewhere',
    latitude: 12.97,
    longitude: 77.59,
    verified: true,
    category: 'mobile_electronics',
    wallet_balance_paise: 0,
    free_deals_used: 0,
    suspended: false,
    required_balance_paise: 30_000,
    distance_meters: 100,
  };
}

/**
 * Wires the service up with just enough of its collaborators to drive
 * `createRequest`, and hands back the update payloads it wrote so the recorded
 * reach can be asserted.
 */
function makeService(opts: {
  matched: NearbyShop[];
  eligible: NearbyShop[];
  /** Why the non-eligible shops were dropped — drives the AUC-95 exclusion split. */
  excludedReason?: ShopExclusionReason;
  /** Shops in radius before category narrowing; defaults to "category changed nothing". */
  inRadius?: number;
}) {
  const updates: Array<Record<string, unknown>> = [];
  const notifyShopNewRequest = jest.fn();

  const prisma = {
    db: {
      productCategory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pc_1',
          name: 'Televisions',
          active: true,
          shopCategories: ['mobile_electronics'],
        }),
      },
      request: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'req_1', ...data }),
        ),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          return Promise.resolve({ id: 'req_1', ...data });
        }),
      },
    },
  } as unknown as PrismaService;

  const reason = opts.excludedReason ?? 'insufficient_balance';
  const excluded: ShopMatchResult['excluded'] = opts.matched
    .filter((m) => !opts.eligible.some((e) => e.id === m.id))
    .map((s) => ({ shop: s, reason }));

  const countShopsInRadius = jest
    .fn()
    .mockResolvedValue(opts.inRadius ?? opts.matched.length);

  const geo = {
    setLocation: jest.fn().mockResolvedValue(undefined),
    findShopsNearby: jest.fn().mockResolvedValue(opts.matched),
    countShopsInRadius,
    partitionByEligibility: jest.fn((): ShopMatchResult => ({
      eligible: opts.eligible,
      excluded,
    })),
  } as unknown as GeoService;

  const gateway = { notifyShopNewRequest } as unknown as RealtimeGateway;
  const push = {
    notifyShop: jest.fn().mockResolvedValue(undefined),
  } as unknown as PushService;
  const geocoder = {
    geocodeArea: jest
      .fn()
      .mockResolvedValue({ latitude: 12.97, longitude: 77.59 }),
  } as unknown as GeocodingProvider;

  const service = new RequestsService(prisma, geo, gateway, push, geocoder);
  return { service, updates, notifyShopNewRequest, countShopsInRadius };
}

const dto = {
  productName: 'Sony Bravia 32 inch TV',
  areaText: 'Koramangala',
  latitude: 12.97,
  longitude: 77.59,
};

describe('RequestsService.createRequest — match reach (AUC-59)', () => {
  const errors: string[] = [];

  beforeEach(() => {
    errors.length = 0;
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((message: unknown) => {
        errors.push(String(message));
      });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('records how many shops matched and were notified', async () => {
    const shops = [shop('s1'), shop('s2'), shop('s3')];
    const { service, updates, notifyShopNewRequest } = makeService({
      matched: shops,
      eligible: shops,
    });

    await service.createRequest('user_1', dto);

    expect(updates).toContainEqual(
      expect.objectContaining({
        matchedShopCount: 3,
        notifiedShopCount: 3,
      }),
    );
    expect(notifyShopNewRequest).toHaveBeenCalledTimes(3);
    expect(errors).toHaveLength(0);
  });

  it('records zero reach and logs an error when nobody is in radius', async () => {
    const { service, updates, notifyShopNewRequest } = makeService({
      matched: [],
      eligible: [],
    });

    await service.createRequest('user_1', dto);

    expect(updates).toContainEqual(
      expect.objectContaining({
        matchedShopCount: 0,
        notifiedShopCount: 0,
      }),
    );
    expect(notifyShopNewRequest).not.toHaveBeenCalled();
    // Silence here is exactly what AUC-59 set out to remove.
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('reached no shops');
    expect(errors[0]).toContain('no shop in radius');
  });

  it('distinguishes "all excluded" from "nobody nearby"', async () => {
    // Shops exist and match the category, but every one is gated out.
    const { service, updates } = makeService({
      matched: [shop('s1'), shop('s2')],
      eligible: [],
    });

    await service.createRequest('user_1', dto);

    // matched > 0 with notified 0 is a billing problem, not a supply one — the
    // two need opposite fixes, so the record has to keep them apart.
    expect(updates).toContainEqual(
      expect.objectContaining({
        matchedShopCount: 2,
        notifiedShopCount: 0,
      }),
    );
    expect(errors[0]).toContain('all 2 matched shop(s) excluded');
  });

  it('names the category when one was picked and nothing matched', async () => {
    const { service } = makeService({ matched: [], eligible: [] });

    await service.createRequest('user_1', {
      ...dto,
      productCategoryId: 'pc_1',
    });

    expect(errors[0]).toContain('no shop in radius serves this category');
  });
});

describe('RequestsService.createRequest — radius instrumentation (AUC-95)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('records the radius the match actually ran at', async () => {
    const { service, updates } = makeService({ matched: [], eligible: [] });

    await service.createRequest('user_1', { ...dto, radiusKm: 12 });

    // Stored rather than assumed constant: a request matched at 12 km must stay
    // readable as a 12 km request even after the default moves.
    expect(updates).toContainEqual(
      expect.objectContaining({ matchRadiusKm: 12 }),
    );
  });

  it('defaults the recorded radius to 5 km when the caller sends none', async () => {
    const { service, updates } = makeService({ matched: [], eligible: [] });

    await service.createRequest('user_1', dto);

    expect(updates).toContainEqual(
      expect.objectContaining({ matchRadiusKm: 5 }),
    );
  });

  it('splits exclusions by reason rather than summing them', async () => {
    const { service, updates } = makeService({
      matched: [shop('s1'), shop('s2')],
      eligible: [],
      excludedReason: 'suspended',
    });

    await service.createRequest('user_1', dto);

    // A moderation problem and a billing problem are indistinguishable once
    // summed, and widening the radius fixes neither.
    expect(updates).toContainEqual(
      expect.objectContaining({
        excludedSuspendedCount: 2,
        excludedInsufficientBalanceCount: 0,
      }),
    );
  });

  it('separates an empty map from a catalogue gap when a category is set', async () => {
    // Ten shops nearby, none of them mapped to this product category.
    const { service, updates, countShopsInRadius } = makeService({
      matched: [],
      eligible: [],
      inRadius: 10,
    });

    await service.createRequest('user_1', {
      ...dto,
      productCategoryId: 'pc_1',
    });

    expect(countShopsInRadius).toHaveBeenCalledWith(12.97, 77.59, 5);
    // inRadius > 0 with matched 0 is a catalogue-mapping gap. Widening the
    // radius would add more shops that also do not serve the category.
    expect(updates).toContainEqual(
      expect.objectContaining({
        inRadiusShopCount: 10,
        matchedShopCount: 0,
      }),
    );
  });

  it('skips the extra count query when no category narrowed the match', async () => {
    const shops = [shop('s1')];
    const { service, updates, countShopsInRadius } = makeService({
      matched: shops,
      eligible: shops,
    });

    await service.createRequest('user_1', dto);

    // Without a category, "in radius" and "matched" are the same set by
    // definition — a second round trip would buy nothing.
    expect(countShopsInRadius).not.toHaveBeenCalled();
    expect(updates).toContainEqual(
      expect.objectContaining({ inRadiusShopCount: 1, matchedShopCount: 1 }),
    );
  });
});

describe('RequestsService.countNearbyShops — pre-post supply signal (AUC-93)', () => {
  it('returns a bare count with no shop identity attached', async () => {
    const shops = [shop('s1'), shop('s2'), shop('s3')];
    const { service } = makeService({ matched: shops, eligible: shops });

    const result = await service.countNearbyShops(12.97, 77.59);

    // The response shape is the guardrail: a name, address or phone here would
    // let a customer contact the shop directly and skip the auction entirely.
    expect(result).toEqual({ count: 3, radiusKm: 5, categoryName: null });
    expect(JSON.stringify(result)).not.toContain('s1');
  });

  it('counts only shops that could actually be notified', async () => {
    // Five shops match on geography and category, two can take a deal.
    const matched = [
      shop('s1'),
      shop('s2'),
      shop('s3'),
      shop('s4'),
      shop('s5'),
    ];
    const { service } = makeService({
      matched,
      eligible: [shop('s1'), shop('s2')],
    });

    const result = await service.countNearbyShops(12.97, 77.59);

    // Counting raw in-radius shops would promise the customer bidders that a
    // suspension or an empty wallet guarantees will never arrive.
    expect(result.count).toBe(2);
  });

  it('reports the category the count was scoped to', async () => {
    const shops = [shop('s1')];
    const { service } = makeService({ matched: shops, eligible: shops });

    const result = await service.countNearbyShops(12.97, 77.59, 'pc_1');

    expect(result.categoryName).toBe('Televisions');
  });

  it('returns zero rather than throwing when nothing is nearby', async () => {
    const { service } = makeService({ matched: [], eligible: [] });

    // Zero is a legitimate answer the UI is required to render as silence, not
    // as "0 shops near you" — so the service must hand back a number, not an error.
    await expect(service.countNearbyShops(12.97, 77.59)).resolves.toEqual({
      count: 0,
      radiusKm: 5,
      categoryName: null,
    });
  });
});
