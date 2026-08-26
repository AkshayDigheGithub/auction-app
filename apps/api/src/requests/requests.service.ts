import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
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

    const request = await this.prisma.db.request.create({
      data: {
        customerUserId,
        productName: dto.productName,
        description: dto.description,
        areaText: dto.areaText,
        latitude,
        longitude,
      },
    });
    await this.geo.setLocation('requests', request.id, latitude, longitude);

    const radiusKm = dto.radiusKm ?? DEFAULT_RADIUS_KM;
    const nearbyShops = await this.geo.findShopsNearby(
      latitude,
      longitude,
      radiusKm,
    );
    for (const shop of nearbyShops) {
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

  async findOpenNearby(
    latitude: number,
    longitude: number,
    radiusKm = DEFAULT_RADIUS_KM,
  ) {
    return this.geo.findOpenRequestsNearby(latitude, longitude, radiusKm);
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
