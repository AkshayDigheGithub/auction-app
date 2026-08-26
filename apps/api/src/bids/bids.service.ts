import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BID_CACHE, type BidCache } from '../realtime/bid-cache.interface';
import { CreateBidDto } from './dto/create-bid.dto';

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    @Inject(BID_CACHE) private readonly bidCache: BidCache,
  ) {}

  /** Shop owner submits a bid (AUC-22); broadcast live to the customer (AUC-24). */
  async submitBid(shopOwnerUserId: string, requestId: string, dto: CreateBidDto) {
    const shop = await this.prisma.db.shop.findUnique({ where: { ownerUserId: shopOwnerUserId } });
    if (!shop) throw new NotFoundException('Create your shop profile before bidding');

    const request = await this.prisma.db.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'open') throw new BadRequestException('Request is no longer open for bids');

    const bid = await this.prisma.db.bid.create({
      data: { requestId, shopId: shop.id, price: dto.price, note: dto.note },
      include: { shop: true },
    });

    await this.bidCache.invalidate(requestId);
    this.gateway.broadcastNewBid(requestId, bid);
    return bid;
  }

  /** Live bid list for a request (AUC-11), Redis/in-memory cached (AUC-23). */
  async listBids(requestId: string) {
    const cached = await this.bidCache.getBids(requestId);
    if (cached) return cached;

    const bids = await this.prisma.db.bid.findMany({
      where: { requestId, status: 'active' },
      include: { shop: true },
      orderBy: { price: 'asc' },
    });
    await this.bidCache.setBids(requestId, bids);
    return bids;
  }

  async getBid(bidId: string) {
    const bid = await this.prisma.db.bid.findUnique({ where: { id: bidId }, include: { shop: true, request: true } });
    if (!bid) throw new NotFoundException('Bid not found');
    return bid;
  }

  /** Marks the winning bid and rejects the rest — called from DealsService on lock. */
  async settleBidsForRequest(requestId: string, winningBidId: string) {
    await this.prisma.db.$transaction([
      this.prisma.db.bid.update({ where: { id: winningBidId }, data: { status: 'won' } }),
      this.prisma.db.bid.updateMany({
        where: { requestId, id: { not: winningBidId } },
        data: { status: 'rejected' },
      }),
    ]);
    await this.bidCache.invalidate(requestId);
  }
}
