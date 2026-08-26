import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NearbyShop {
  id: string;
  shop_name: string;
  address: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  distance_meters: number;
}

export interface NearbyRequest {
  id: string;
  product_name: string;
  description: string | null;
  area_text: string;
  latitude: number;
  longitude: number;
  created_at: Date;
  distance_meters: number;
}

/** PostGIS radius matching between requests and shops (AUC-3 / AUC-18). */
@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Set/refresh the `geography(Point,4326)` column for a shop or request row. */
  async setLocation(table: 'shops' | 'requests', id: string, latitude: number, longitude: number) {
    // Table/column names here are fixed literals, not user input — safe to
    // interpolate; values are still passed as bind parameters.
    await this.prisma.db.$executeRawUnsafe(
      `UPDATE "${table}" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3`,
      longitude,
      latitude,
      id,
    );
  }

  /** Shops within `radiusKm` of a point, nearest first. Default radius matches spec §2 (5km). */
  async findShopsNearby(latitude: number, longitude: number, radiusKm = 5): Promise<NearbyShop[]> {
    const radiusMeters = radiusKm * 1000;
    return this.prisma.db.$queryRaw<NearbyShop[]>`
      SELECT id, shop_name, address, latitude, longitude, verified,
             ST_Distance(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) AS distance_meters
      FROM shops
      WHERE location IS NOT NULL
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusMeters})
      ORDER BY distance_meters ASC
    `;
  }

  /** Open requests within `radiusKm` of a shop's point, nearest first — powers the shop's "nearby requests" list. */
  async findOpenRequestsNearby(latitude: number, longitude: number, radiusKm = 5): Promise<NearbyRequest[]> {
    const radiusMeters = radiusKm * 1000;
    return this.prisma.db.$queryRaw<NearbyRequest[]>`
      SELECT id, product_name, description, area_text, latitude, longitude, created_at,
             ST_Distance(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) AS distance_meters
      FROM requests
      WHERE status = 'open'
        AND location IS NOT NULL
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusMeters})
      ORDER BY distance_meters ASC
    `;
  }
}
