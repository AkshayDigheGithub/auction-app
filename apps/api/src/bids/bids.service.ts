import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BID_CACHE, type BidCache } from '../realtime/bid-cache.interface';
import { CreateBidDto } from './dto/create-bid.dto';
import {
  PricingService,
  type ShopCategoryName,
} from '../pricing/pricing.service';
import { isLiveBilling } from '../pricing/billing-mode';
import { formatPaise } from '../pricing/fee.util';
import { FREE_DEALS_PER_SHOP } from '../deals/billing.constants';

/**
 * The only shop fields a customer is entitled to see on a bid.
 *
 * `include: { shop: true }` used to spread the whole row into every bid — wallet
 * balance, UPI id, GST number, owner user id, suspension reason. None of that
 * is needed to choose a bid, and a shop owner has a reasonable expectation that
 * their balance is not visible to the people bidding reaches.
 *
 * Shared with the socket broadcast in `submitBid` so the live-inserted bid has
 * exactly the same shape as a refetched one — otherwise the customer's list
 * renders two different objects depending on how the bid arrived.
 */
const CUSTOMER_VISIBLE_SHOP = {
  select: { id: true, shopName: true, verified: true },
} as const;

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    @Inject(BID_CACHE) private readonly bidCache: BidCache,
    private readonly pricing: PricingService,
  ) {}

  /** Shop owner submits a bid (AUC-22); broadcast live to the customer (AUC-24). */
  async submitBid(
    shopOwnerUserId: string,
    requestId: string,
    dto: CreateBidDto,
  ) {
    const shop = await this.prisma.db.shop.findUnique({
      where: { ownerUserId: shopOwnerUserId },
    });
    if (!shop)
      throw new NotFoundException('Create your shop profile before bidding');

    const request = await this.prisma.db.request.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'open')
      throw new BadRequestException('Request is no longer open for bids');

    await this.assertCanAffordToWin(shop);

    const bid = await this.prisma.db.bid.create({
      data: { requestId, shopId: shop.id, price: dto.price, note: dto.note },
      include: { shop: CUSTOMER_VISIBLE_SHOP },
    });

    await this.bidCache.invalidate(requestId);
    this.gateway.broadcastNewBid(requestId, bid);
    return bid;
  }

  /**
   * Stop a shop bidding on something it couldn't afford to win (AUC-53).
   *
   * Checked here as well as at match time because a shop can reach a request by
   * a direct link, and letting it bid only to fail at lock would waste both the
   * shop's effort and the customer's. The message is explicit and points at the
   * fix rather than failing vaguely.
   */
  private async assertCanAffordToWin(shop: {
    id: string;
    category: string;
    suspended: boolean;
    freeDealsUsed: number;
    walletBalancePaise: number;
  }) {
    if (shop.suspended) {
      throw new BadRequestException(
        'Your shop is suspended and cannot bid. Contact support.',
      );
    }
    if (!isLiveBilling()) return;
    if (shop.freeDealsUsed < FREE_DEALS_PER_SHOP) return;

    const required = await this.pricing.maxFeePaise(
      shop.category as ShopCategoryName,
    );
    if (shop.walletBalancePaise < required) {
      throw new BadRequestException(
        `Your balance is ${formatPaise(shop.walletBalancePaise)}. You need at least ${formatPaise(required)} to take on a new deal — top up to keep receiving customers.`,
      );
    }
  }

  /**
   * Live bid list for a request (AUC-11), Redis/in-memory cached (AUC-23).
   *
   * `customerUserId` is required, not optional: this list is what makes bidding
   * blind, so the ownership check has to be impossible to forget at a call site.
   * The check runs before the cache read — a cache hit must not be a way around
   * authorisation.
   */
  async listBids(requestId: string, customerUserId: string) {
    const request = await this.prisma.db.request.findUnique({
      where: { id: requestId },
      select: { customerUserId: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    // Deliberately NotFound rather than Forbidden: telling a stranger "this
    // exists but is not yours" confirms a valid request id for them.
    if (request.customerUserId !== customerUserId)
      throw new NotFoundException('Request not found');

    const cached = await this.bidCache.getBids(requestId);
    if (cached) return cached;

    const bids = await this.prisma.db.bid.findMany({
      where: { requestId, status: 'active' },
      include: { shop: CUSTOMER_VISIBLE_SHOP },
      orderBy: { price: 'asc' },
    });
    await this.bidCache.setBids(requestId, bids);
    return bids;
  }

  async getBid(bidId: string) {
    const bid = await this.prisma.db.bid.findUnique({
      where: { id: bidId },
      include: { shop: true, request: true },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    return bid;
  }

  /** Marks the winning bid and rejects the rest — called from DealsService on lock. */
  async settleBidsForRequest(requestId: string, winningBidId: string) {
    await this.prisma.db.$transaction([
      this.prisma.db.bid.update({
        where: { id: winningBidId },
        data: { status: 'won' },
      }),
      this.prisma.db.bid.updateMany({
        where: { requestId, id: { not: winningBidId } },
        data: { status: 'rejected' },
      }),
    ]);
    await this.bidCache.invalidate(requestId);
  }
}
