import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
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

    // Which kinds of shop can serve this request (AUC-59). Null when the
    // customer didn't pick a category, which matches every shop as before.
    let matchCategories: ShopCategoryName[] | undefined;
    if (dto.productCategoryId) {
      const pc = await this.prisma.db.productCategory.findUnique({
        where: { id: dto.productCategoryId },
        select: { id: true, active: true, shopCategories: true },
      });
      if (!pc || !pc.active) {
        throw new BadRequestException('That product category is not available');
      }
      matchCategories = pc.shopCategories;
    }

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
    const { eligible, excluded } = this.geo.partitionByEligibility(matched, {
      enforceBalance: isLiveBilling(),
      freeDealsPerShop: FREE_DEALS_PER_SHOP,
    });

    // Persist the match outcome so admin can find these later (AUC-59). A
    // request that reaches nobody is invisible from the outside — the customer
    // just sees a bid list that never fills — so it has to be recorded at post
    // time rather than inferred afterwards.
    await this.prisma.db.request.update({
      where: { id: request.id },
      data: {
        matchedShopCount: matched.length,
        notifiedShopCount: eligible.length,
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
