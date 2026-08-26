import { Injectable, NotFoundException } from '@nestjs/common';
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
    const shop = await this.prisma.db.shop.upsert({
      where: { ownerUserId },
      update: { ...dto },
      create: { ownerUserId, ...dto },
    });
    // Unsupported() columns can't be written through the normal Prisma
    // create/update — refresh the geography point with a follow-up raw query.
    await this.geo.setLocation('shops', shop.id, dto.latitude, dto.longitude);
    return shop;
  }

  async getMyShop(ownerUserId: string) {
    const shop = await this.prisma.db.shop.findUnique({ where: { ownerUserId } });
    if (!shop) throw new NotFoundException('No shop profile yet — create one first');
    return shop;
  }

  /** Admin-only: manual "Verified" badge grant (AUC-17). */
  async setVerified(shopId: string, verified: boolean) {
    return this.prisma.db.shop.update({ where: { id: shopId }, data: { verified } });
  }
}
