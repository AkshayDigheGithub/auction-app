import { Logger } from '@nestjs/common';
import { RequestsService } from './requests.service';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  GeoService,
  NearbyShop,
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
function makeService(opts: { matched: NearbyShop[]; eligible: NearbyShop[] }) {
  const updates: Array<Record<string, unknown>> = [];
  const notifyShopNewRequest = jest.fn();

  const prisma = {
    db: {
      productCategory: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pc_1',
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

  const excluded: ShopMatchResult['excluded'] = opts.matched
    .filter((m) => !opts.eligible.some((e) => e.id === m.id))
    .map((s) => ({ shop: s, reason: 'insufficient_balance' as const }));

  const geo = {
    setLocation: jest.fn().mockResolvedValue(undefined),
    findShopsNearby: jest.fn().mockResolvedValue(opts.matched),
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
  return { service, updates, notifyShopNewRequest };
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

    expect(updates).toContainEqual({
      matchedShopCount: 3,
      notifiedShopCount: 3,
    });
    expect(notifyShopNewRequest).toHaveBeenCalledTimes(3);
    expect(errors).toHaveLength(0);
  });

  it('records zero reach and logs an error when nobody is in radius', async () => {
    const { service, updates, notifyShopNewRequest } = makeService({
      matched: [],
      eligible: [],
    });

    await service.createRequest('user_1', dto);

    expect(updates).toContainEqual({
      matchedShopCount: 0,
      notifiedShopCount: 0,
    });
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
    expect(updates).toContainEqual({
      matchedShopCount: 2,
      notifiedShopCount: 0,
    });
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
