import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
import { GEOCODING_PROVIDER, type GeocodingProvider } from '../geo/geocoding-provider.interface';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateRequestDto } from './dto/create-request.dto';

const DEFAULT_RADIUS_KM = 5;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly gateway: RealtimeGateway,
    @Inject(GEOCODING_PROVIDER) private readonly geocoder: GeocodingProvider,
  ) {}

  /** Post a request (AUC-10) and fan out to nearby shop owners over the socket (AUC-21). */
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
    const nearbyShops = await this.geo.findShopsNearby(latitude, longitude, radiusKm);
    for (const shop of nearbyShops) {
      this.gateway.notifyShopNewRequest(shop.id, request);
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

  async findOpenNearby(latitude: number, longitude: number, radiusKm = DEFAULT_RADIUS_KM) {
    return this.geo.findOpenRequestsNearby(latitude, longitude, radiusKm);
  }

  async markLocked(requestId: string) {
    return this.prisma.db.request.update({ where: { id: requestId }, data: { status: 'locked' } });
  }

  async markCompleted(requestId: string) {
    return this.prisma.db.request.update({ where: { id: requestId }, data: { status: 'completed' } });
  }
}
