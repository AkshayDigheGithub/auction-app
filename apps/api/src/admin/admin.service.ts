import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopsService } from '../shops/shops.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopsService: ShopsService,
  ) {}

  /** AUC-33 */
  listRequests() {
    return this.prisma.db.request.findMany({
      include: { bids: true, deal: true, customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  listDeals() {
    return this.prisma.db.deal.findMany({
      include: { shop: true, request: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  listShops() {
    return this.prisma.db.shop.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** AUC-17 */
  setShopVerified(shopId: string, verified: boolean) {
    return this.shopsService.setVerified(shopId, verified);
  }

  /** AUC-35 */
  async revenueSummary() {
    const result = await this.prisma.db.deal.aggregate({
      where: { commissionStatus: 'paid' },
      _sum: { commissionAmount: true },
      _count: { _all: true },
    });
    return {
      totalCommissionPaid: result._sum.commissionAmount ?? 0,
      paidDealsCount: result._count._all,
    };
  }
}
