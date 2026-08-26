import { Controller, Get, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  PricingService,
  SHOP_CATEGORIES,
  SHOP_CATEGORY_LABELS,
} from '../pricing/pricing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * Read-only catalog for the apps: the customer's category picker (AUC-61) and
 * the shop onboarding category list with its rate (AUC-62).
 */
@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
  ) {}

  @Get('product-categories')
  productCategories() {
    return this.catalog.listActiveTree();
  }

  /**
   * Shop categories with the fee each one attracts. The rate is shown to the
   * shop owner BEFORE they commit at onboarding — pricing transparency at
   * signup is a trust feature, not a disclosure chore (AUC-62).
   */
  @Get('shop-categories')
  async shopCategories() {
    const rates = await this.pricing.listRates();
    return SHOP_CATEGORIES.map((category) => {
      const rate = rates.find((r) => r.category === category);
      return {
        category,
        label: SHOP_CATEGORY_LABELS[category],
        rateBps: rate?.rateBps ?? null,
        capPaise: rate?.capPaise ?? null,
        floorPaise: rate?.floorPaise ?? null,
        flatFeePaise: rate?.flatFeePaise ?? null,
        active: rate?.active ?? false,
      };
    });
  }
}
