import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeFee, type FeeQuote, type FeeRule } from './fee.util';

export type ShopCategoryName =
  | 'mobile_electronics'
  | 'computers'
  | 'appliances'
  | 'hardware'
  | 'auto_parts'
  | 'furniture'
  | 'apparel'
  | 'jewellery'
  | 'grocery';

export const SHOP_CATEGORIES: ShopCategoryName[] = [
  'mobile_electronics',
  'computers',
  'appliances',
  'hardware',
  'auto_parts',
  'furniture',
  'apparel',
  'jewellery',
  'grocery',
];

export const SHOP_CATEGORY_LABELS: Record<ShopCategoryName, string> = {
  mobile_electronics: 'Mobile & Electronics',
  computers: 'Computers',
  appliances: 'Home Appliances',
  hardware: 'Hardware & Building',
  auto_parts: 'Auto Parts',
  furniture: 'Furniture',
  apparel: 'Apparel & Footwear',
  jewellery: 'Jewellery',
  grocery: 'Grocery',
};

/**
 * Used for balance gating when a category has no cap: without an upper bound
 * there is no way to know how much balance is "enough", so we require this much.
 */
const UNCAPPED_GATING_ASSUMPTION_PAISE = 50_000; // ₹500

/** A rate above this needs deliberate confirmation from admin (AUC-66). */
export const RATE_SANITY_THRESHOLD_BPS = 500; // 5%

interface UpdateRateInput {
  rateBps?: number;
  capPaise?: number | null;
  floorPaise?: number;
  flatFeePaise?: number | null;
  active?: boolean;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger('PricingService');
  /** Rates change rarely and are read on every lock — worth a short cache. */
  private cache = new Map<string, { rule: FeeRule; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  private invalidate(category?: string) {
    if (category) this.cache.delete(category);
    else this.cache.clear();
  }

  async getRule(category: ShopCategoryName): Promise<FeeRule> {
    const cached = this.cache.get(category);
    if (cached && cached.expiresAt > Date.now()) return cached.rule;

    const row = await this.prisma.db.commissionRate.findUnique({
      where: { category },
    });
    if (!row) {
      // A category with no configured rate must not silently bill ₹0 — that
      // would be a quiet revenue leak nobody notices for months.
      throw new NotFoundException(
        `No commission rate configured for category "${category}". Seed it in admin before shops in this category can win deals.`,
      );
    }
    if (!row.active) {
      throw new BadRequestException(
        `Commission rate for "${category}" is deactivated.`,
      );
    }

    const rule: FeeRule = {
      rateBps: row.rateBps,
      capPaise: row.capPaise,
      floorPaise: row.floorPaise,
      flatFeePaise: row.flatFeePaise,
    };
    this.cache.set(category, {
      rule,
      expiresAt: Date.now() + PricingService.CACHE_TTL_MS,
    });
    return rule;
  }

  async quote(
    category: ShopCategoryName,
    pricePaise: number,
  ): Promise<FeeQuote> {
    return computeFee(pricePaise, await this.getRule(category));
  }

  /**
   * The most a shop in this category could be charged for a single deal — the
   * balance a shop must hold to stay eligible for matching (AUC-53).
   */
  async maxFeePaise(category: ShopCategoryName): Promise<number> {
    const rule = await this.getRule(category);
    if (rule.flatFeePaise != null) return rule.flatFeePaise;
    return rule.capPaise ?? UNCAPPED_GATING_ASSUMPTION_PAISE;
  }

  listRates() {
    return this.prisma.db.commissionRate.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async updateRate(category: ShopCategoryName, input: UpdateRateInput) {
    const before = await this.prisma.db.commissionRate.findUnique({
      where: { category },
    });
    if (!before)
      throw new NotFoundException(`No rate configured for "${category}"`);

    if (
      input.rateBps != null &&
      (input.rateBps < 0 || input.rateBps > 10_000)
    ) {
      throw new BadRequestException(
        'rateBps must be between 0 and 10000 (0%–100%)',
      );
    }
    if (input.floorPaise != null && input.floorPaise < 0) {
      throw new BadRequestException('floorPaise cannot be negative');
    }
    if (input.capPaise != null && input.capPaise < 0) {
      throw new BadRequestException('capPaise cannot be negative');
    }

    const after = await this.prisma.db.commissionRate.update({
      where: { category },
      data: input,
    });
    this.invalidate(category);
    this.logger.log(
      `Rate for ${category}: ${before.rateBps}bps -> ${after.rateBps}bps, cap ${before.capPaise} -> ${after.capPaise}`,
    );
    return { before, after };
  }

  /**
   * What the fee would be on sample deal values, so an admin can see the
   * real-world effect of a rate before saving it (AUC-66). "0.6% capped ₹300"
   * is abstract; "a ₹70,000 phone earns ₹300" is not.
   */
  preview(rule: FeeRule, samplesPaise = [500_000, 3_000_000, 7_000_000]) {
    return samplesPaise.map((pricePaise) => ({
      pricePaise,
      feePaise: computeFee(pricePaise, rule).amountPaise,
    }));
  }
}
