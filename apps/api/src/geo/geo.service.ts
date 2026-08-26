import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ShopCategoryName } from '../pricing/pricing.service';

export interface NearbyShop {
  id: string;
  shop_name: string;
  address: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  category: ShopCategoryName;
  wallet_balance_paise: number;
  free_deals_used: number;
  suspended: boolean;
  /** Balance this shop needs to be able to cover one deal in its category. */
  required_balance_paise: number;
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
  product_category_id: string | null;
  distance_meters: number;
}

export type ShopExclusionReason = 'suspended' | 'insufficient_balance';

export interface ShopMatchResult {
  eligible: NearbyShop[];
  excluded: Array<{ shop: NearbyShop; reason: ShopExclusionReason }>;
}

/** Fallback when a category has no cap — mirrors PricingService. */
const UNCAPPED_GATING_ASSUMPTION_PAISE = 50_000;

/** PostGIS radius matching between requests and shops (AUC-3 / AUC-18 / AUC-59). */
@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Set/refresh the `geography(Point,4326)` column for a shop or request row. */
  async setLocation(
    table: 'shops' | 'requests',
    id: string,
    latitude: number,
    longitude: number,
  ) {
    // Table/column names here are fixed literals, not user input — safe to
    // interpolate; values are still passed as bind parameters.
    await this.prisma.db.$executeRawUnsafe(
      `UPDATE "${table}" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3`,
      longitude,
      latitude,
      id,
    );
  }

  /**
   * Shops within `radiusKm` of a point, nearest first.
   *
   * `categories` narrows to shops that serve at least one of them, as primary or
   * secondary (AUC-59) — a furniture shop should never be woken up for an
   * iPhone request. Passing none keeps the old behaviour of matching everyone.
   *
   * The joined `required_balance_paise` is what a shop in that category would
   * need to cover one deal, so the caller can apply balance gating (AUC-53)
   * without a second round trip.
   */
  async findShopsNearby(
    latitude: number,
    longitude: number,
    radiusKm = 5,
    categories?: ShopCategoryName[],
  ): Promise<NearbyShop[]> {
    const radiusMeters = radiusKm * 1000;
    // Comma-joined rather than a Postgres array parameter: enum[] binding is
    // awkward across drivers, and string_to_array keeps this a plain bind param
    // instead of interpolated SQL.
    const categoryCsv = categories?.length ? categories.join(',') : null;

    return this.prisma.db.$queryRaw<NearbyShop[]>`
      SELECT s.id, s.shop_name, s.address, s.latitude, s.longitude, s.verified,
             s.category, s.wallet_balance_paise, s.free_deals_used, s.suspended,
             COALESCE(cr.flat_fee_paise, cr.cap_paise, ${UNCAPPED_GATING_ASSUMPTION_PAISE}) AS required_balance_paise,
             ST_Distance(s.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) AS distance_meters
      FROM shops s
      LEFT JOIN commission_rates cr ON cr.category = s.category
      WHERE s.location IS NOT NULL
        AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusMeters})
        AND (
          ${categoryCsv}::text IS NULL
          OR s.category::text = ANY(string_to_array(${categoryCsv}::text, ','))
          OR s.secondary_categories::text[] && string_to_array(${categoryCsv}::text, ',')
        )
      ORDER BY distance_meters ASC
    `;
  }

  /**
   * Split matched shops into those that can currently take a deal and those that
   * can't, with the reason.
   *
   * The distinction matters operationally: "no shops in radius" and "every shop
   * is out of balance" look identical to a customer but have opposite fixes —
   * one is a supply problem, the other is a billing problem (AUC-53).
   */
  partitionByEligibility(
    shops: NearbyShop[],
    opts: { enforceBalance: boolean; freeDealsPerShop: number },
  ): ShopMatchResult {
    const eligible: NearbyShop[] = [];
    const excluded: ShopMatchResult['excluded'] = [];

    for (const shop of shops) {
      if (shop.suspended) {
        excluded.push({ shop, reason: 'suspended' });
        continue;
      }
      if (!opts.enforceBalance) {
        eligible.push(shop);
        continue;
      }
      const onTrial = shop.free_deals_used < opts.freeDealsPerShop;
      const funded =
        Number(shop.wallet_balance_paise) >=
        Number(shop.required_balance_paise);
      if (onTrial || funded) eligible.push(shop);
      else excluded.push({ shop, reason: 'insufficient_balance' });
    }

    return { eligible, excluded };
  }

  /** Open requests within `radiusKm` of a shop's point, nearest first — powers the shop's "nearby requests" list. */
  async findOpenRequestsNearby(
    latitude: number,
    longitude: number,
    radiusKm = 5,
    categories?: ShopCategoryName[],
  ): Promise<NearbyRequest[]> {
    const radiusMeters = radiusKm * 1000;
    const categoryCsv = categories?.length ? categories.join(',') : null;

    // An untagged request (product_category_id IS NULL) stays visible to every
    // shop — category sharpens matching but must never hide demand entirely.
    return this.prisma.db.$queryRaw<NearbyRequest[]>`
      SELECT r.id, r.product_name, r.description, r.area_text, r.latitude, r.longitude,
             r.created_at, r.product_category_id,
             ST_Distance(r.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) AS distance_meters
      FROM requests r
      LEFT JOIN product_categories pc ON pc.id = r.product_category_id
      WHERE r.status = 'open'
        AND r.location IS NOT NULL
        AND ST_DWithin(r.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusMeters})
        AND (
          ${categoryCsv}::text IS NULL
          OR r.product_category_id IS NULL
          OR pc.shop_categories::text[] && string_to_array(${categoryCsv}::text, ',')
        )
      ORDER BY distance_meters ASC
    `;
  }
}
