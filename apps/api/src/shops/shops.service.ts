import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
import { UpsertShopDto } from './dto/upsert-shop.dto';

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  async upsertMyShop(ownerUserId: string, dto: UpsertShopDto) {
    const existing = await this.prisma.db.shop.findUnique({
      where: { ownerUserId },
    });

    // Category changes after onboarding need admin approval (AUC-62): a shop
    // that could re-categorise itself freely could arbitrage the rate table —
    // register as `jewellery` at 0.30%, then take electronics deals. Everything
    // else on the profile stays self-service.
    const categoryChanged =
      existing != null && existing.category !== dto.category;
    if (categoryChanged) {
      throw new BadRequestException(
        'Your shop category affects the fee you pay, so it can only be changed by support. Everything else you can update yourself.',
      );
    }

    const { category, ...rest } = dto;
    const shop = await this.prisma.db.shop.upsert({
      where: { ownerUserId },
      update: rest,
      create: { ownerUserId, category, ...rest },
    });
    // Unsupported() columns can't be written through the normal Prisma
    // create/update — refresh the geography point with a follow-up raw query.
    await this.geo.setLocation('shops', shop.id, dto.latitude, dto.longitude);
    return shop;
  }

  async getMyShop(ownerUserId: string) {
    const shop = await this.prisma.db.shop.findUnique({
      where: { ownerUserId },
    });
    if (!shop)
      throw new NotFoundException('No shop profile yet — create one first');
    return shop;
  }

  /** Admin-only: manual "Verified" badge grant (AUC-17). */
  async setVerified(shopId: string, verified: boolean) {
    return this.prisma.db.shop.update({
      where: { id: shopId },
      data: { verified },
    });
  }
}
