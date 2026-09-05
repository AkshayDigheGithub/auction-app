import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GeoService,
  type ShopExclusionReason,
  type ShopMatchResult,
} from '../geo/geo.service';
import type { ShopCategoryName } from '../pricing/pricing.service';
import { isLiveBilling } from '../pricing/billing-mode';
import { FREE_DEALS_PER_SHOP } from '../deals/billing.constants';
import {
  GEOCODING_PROVIDER,
  type GeocodingProvider,
} from '../geo/geocoding-provider.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PushService } from '../push/push.service';
import { CreateRequestDto } from './dto/create-request.dto';

const DEFAULT_RADIUS_KM = 5;

/** Count of shops dropped for one specific reason, for the AUC-95 instrumentation. */
function countExcluded(
  excluded: ShopMatchResult['excluded'],
  reason: ShopExclusionReason,
): number {
  return excluded.filter((e) => e.reason === reason).length;
}

@Injectable()
export class RequestsService {
  private readonly logger = new Logger('RequestsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly gateway: RealtimeGateway,
    private readonly push: PushService,
    @Inject(GEOCODING_PROVIDER) private readonly geocoder: GeocodingProvider,
  ) {}

  /**
   * Post a request (AUC-10) and fan out to nearby shop owners: an in-app
   * socket update for anyone with the app open (AUC-24-style live UI), plus
   * a real Web Push notification so they're notified even with the app
   * closed (AUC-21).
   */
  async createRequest(customerUserId: string, dto: CreateRequestDto) {
    let { latitude, longitude } = dto;
    if (latitude == null || longitude == null) {
      const geocoded = await this.geocoder.geocodeArea(dto.areaText);
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

    const { categories: matchCategories } = await this.resolveMatchCategories(
      dto.productCategoryId,
    );

    const request = await this.prisma.db.request.create({
      data: {
        customerUserId,
        productName: dto.productName,
        description: dto.description,
        areaText: dto.areaText,
        latitude,
        longitude,
        productCategoryId: dto.productCategoryId,
      },
    });
    await this.geo.setLocation('requests', request.id, latitude, longitude);

    const radiusKm = dto.radiusKm ?? DEFAULT_RADIUS_KM;
    const matched = await this.geo.findShopsNearby(
      latitude,
      longitude,
      radiusKm,
      matchCategories,
    );

    // Balance gating only bites in live billing — in shadow mode nothing is
    // charged, so nothing should be withheld (AUC-53).
    const enforceBalance = isLiveBilling();
    const { eligible, excluded } = this.geo.partitionByEligibility(matched, {
      enforceBalance,
      freeDealsPerShop: FREE_DEALS_PER_SHOP,
    });

    // Only worth a second query when a category actually narrowed the match —
    // without one, "in radius" and "matched" are the same set by definition
    // (AUC-95).
    const inRadiusShopCount = matchCategories
      ? await this.geo.countShopsInRadius(latitude, longitude, radiusKm)
      : matched.length;

    // Persist the match outcome so admin can find these later (AUC-59). A
    // request that reaches nobody is invisible from the outside — the customer
    // just sees a bid list that never fills — so it has to be recorded at post
    // time rather than inferred afterwards.
    //
    // The radius and the exclusion split alongside it are the AUC-95
    // instrumentation. They are written here, in the same update, because they
    // describe the same single matching event — recording them separately would
    // let a request exist with a match count but no radius to interpret it
    // against, which is worse than no data.
    await this.prisma.db.request.update({
      where: { id: request.id },
      data: {
        matchedShopCount: matched.length,
        notifiedShopCount: eligible.length,
        matchRadiusKm: radiusKm,
        inRadiusShopCount,
        excludedSuspendedCount: countExcluded(excluded, 'suspended'),
        excludedInsufficientBalanceCount: countExcluded(
          excluded,
          'insufficient_balance',
        ),
        balanceEnforced: enforceBalance,
      },
    });

    if (excluded.length) {
      // Logged so admin can tell a supply problem ("nobody nearby") from a
      // billing problem ("everybody nearby is out of balance") — these look
      // identical to the customer but have opposite fixes.
      const byReason = excluded.reduce<Record<string, number>>((acc, e) => {
        acc[e.reason] = (acc[e.reason] ?? 0) + 1;
        return acc;
      }, {});
      this.logger.warn(
        `Request ${request.id}: ${eligible.length} shop(s) notified, ${excluded.length} excluded (${JSON.stringify(byReason)})`,
      );
    }

    if (eligible.length === 0) {
      // Error, not warn: nobody was told about this request, so it cannot be
      // bid on. Silence here is what AUC-59 set out to remove.
      const cause =
        matched.length === 0
          ? dto.productCategoryId
            ? 'no shop in radius serves this category'
            : 'no shop in radius'
          : `all ${matched.length} matched shop(s) excluded`;
      this.logger.error(
        `Request ${request.id} ("${dto.productName}" near ${dto.areaText}, ${radiusKm}km) reached no shops — ${cause}`,
      );
    }

    for (const shop of eligible) {
      this.gateway.notifyShopNewRequest(shop.id, request);
      // Fire-and-forget — a failed/slow push shouldn't hold up the response.
      this.push
        .notifyShop(shop.id, {
          title: 'New request nearby',
          body: `${dto.productName} — ${dto.areaText}`,
          url: '/nearby',
        })
        .catch((err) =>
          this.logger.warn(
            `Push notify failed for shop ${shop.id}: ${(err as Error).message}`,
          ),
        );
    }

    return request;
  }

  /**
   * Which kinds of shop can serve a given product category (AUC-59), plus the
   * category's display name.
   *
   * Shared by createRequest and countNearbyShops on purpose: the pre-post count
   * (AUC-93) is a promise about who will be woken up, so it has to be computed
   * from the same category expansion the real match uses. Two copies of this
   * would drift, and the visible symptom would be the app promising bidders it
   * then fails to notify.
   *
   * Undefined categories mean "no category picked", which matches every shop, as
   * it did before categories existed.
   */
  private async resolveMatchCategories(productCategoryId?: string): Promise<{
    categories?: ShopCategoryName[];
    categoryName: string | null;
  }> {
    if (!productCategoryId)
      return { categories: undefined, categoryName: null };

    const pc = await this.prisma.db.productCategory.findUnique({
      where: { id: productCategoryId },
      select: { id: true, name: true, active: true, shopCategories: true },
    });
    if (!pc || !pc.active) {
      throw new BadRequestException('That product category is not available');
    }
    return { categories: pc.shopCategories, categoryName: pc.name };
  }

  /**
   * How many shops would actually be notified if this request were posted here
   * and now (AUC-93).
   *
   * Returns a count and nothing else. Shop identity — name, address, phone —
   * stays hidden until deal lock, and that is not a privacy nicety: hidden
   * identity is what forces request → bid → lock, which is the only point the
   * platform earns anything. A list here would be a free directory around the
   * auction.
   *
   * Counts *eligible* shops, not raw in-radius ones, so the number cannot
   * overpromise: a suspended or unfunded shop is not going to bid, and
   * including it would show a customer supply that does not exist for them.
   */
  async countNearbyShops(
    latitude: number,
    longitude: number,
    productCategoryId?: string,
  ): Promise<{ count: number; radiusKm: number; categoryName: string | null }> {
    const { categories, categoryName } =
      await this.resolveMatchCategories(productCategoryId);

    const radiusKm = DEFAULT_RADIUS_KM;
    const matched = await this.geo.findShopsNearby(
      latitude,
      longitude,
      radiusKm,
      categories,
    );
    const { eligible } = this.geo.partitionByEligibility(matched, {
      enforceBalance: isLiveBilling(),
      freeDealsPerShop: FREE_DEALS_PER_SHOP,
    });

    return { count: eligible.length, radiusKm, categoryName };
  }

  async getRequest(id: string) {
    const request = await this.prisma.db.request.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async listMyRequests(customerUserId: string) {
    return this.prisma.db.request.findMany({
      where: { customerUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * The shop's "requests near me" list, narrowed to categories it actually
   * serves (AUC-59). Under the wallet model an irrelevant lead isn't just noise:
   * it's a lead the shop could win and be charged for on a sale it was never
   * going to make.
   */
  async findOpenNearby(
    ownerUserId: string,
    latitude: number,
    longitude: number,
    radiusKm = DEFAULT_RADIUS_KM,
  ) {
    const shop = await this.prisma.db.shop.findUnique({
      where: { ownerUserId },
      select: { category: true, secondaryCategories: true },
    });
    const categories = shop
      ? ([
          shop.category,
          ...(shop.secondaryCategories ?? []),
        ] as ShopCategoryName[])
      : undefined;
    return this.geo.findOpenRequestsNearby(
      latitude,
      longitude,
      radiusKm,
      categories,
    );
  }

  async markLocked(requestId: string) {
    return this.prisma.db.request.update({
      where: { id: requestId },
      data: { status: 'locked' },
    });
  }

  async markCompleted(requestId: string) {
    return this.prisma.db.request.update({
      where: { id: requestId },
      data: { status: 'completed' },
    });
  }
}
