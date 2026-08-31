import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DisputeParty,
  DisputeReason,
  DisputeStatus,
} from '../../generated/prisma/client.js';
import {
  DETAILS_MIN_LENGTH,
  DISPUTE_WINDOW_DAYS,
  REASONS_BY_PARTY,
  REASONS_REQUIRING_DETAILS,
} from './dispute.constants';

export interface ListDisputesOpts {
  status?: DisputeStatus;
  shopId?: string;
  reason?: DisputeReason;
  skip?: number;
  take?: number;
}

const DEAL_INCLUDE = {
  deal: {
    select: {
      id: true,
      finalPrice: true,
      qrStatus: true,
      createdAt: true,
      request: { select: { productName: true } },
      customer: { select: { id: true, phoneNumber: true, name: true } },
    },
  },
  shop: { select: { id: true, shopName: true, verified: true, suspended: true } },
  raisedBy: { select: { id: true, phoneNumber: true, name: true } },
} as const;

/**
 * Conduct disputes (AUC-34).
 *
 * Separate from the billing reversal in DealsService on purpose. A reversal
 * answers "should this fee stand" and moves money; a dispute answers "did this
 * shop behave" and moves nothing. Keeping them apart means disputes keep
 * working while billing sits in shadow mode, which is exactly the pilot's
 * situation.
 */
@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------- raising

  /**
   * Raise a dispute on a deal you were part of.
   *
   * `party` is derived here from proven participation in the deal, never taken
   * from the caller — it decides which reasons are even sayable, so trusting
   * the request body would let a shop file customer-only complaints against
   * itself and poison its own complaint count.
   */
  async raise(input: {
    userId: string;
    role: 'customer' | 'shop_owner';
    dealId: string;
    reason: DisputeReason;
    details?: string;
  }) {
    const deal = await this.prisma.db.deal.findUnique({
      where: { id: input.dealId },
      include: { shop: { select: { id: true, ownerUserId: true } } },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const party = await this.partyFor(deal, input.userId, input.role);

    if (!REASONS_BY_PARTY[party].includes(input.reason)) {
      throw new BadRequestException(
        `A ${party === 'customer' ? 'customer' : 'shop'} cannot raise "${input.reason}" on a deal.`,
      );
    }

    const details = input.details?.trim() || undefined;
    if (
      REASONS_REQUIRING_DETAILS.includes(input.reason) &&
      (details?.length ?? 0) < DETAILS_MIN_LENGTH
    ) {
      throw new BadRequestException(
        `Please describe what happened in at least ${DETAILS_MIN_LENGTH} characters.`,
      );
    }

    if (!this.withinWindow(deal.createdAt)) {
      throw new BadRequestException(
        `Disputes must be raised within ${DISPUTE_WINDOW_DAYS} days of the deal.`,
      );
    }

    const existing = await this.prisma.db.dispute.findUnique({
      where: {
        dealId_raisedByUserId: {
          dealId: input.dealId,
          raisedByUserId: input.userId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You have already raised a dispute on this deal.',
      );
    }

    const dispute = await this.prisma.db.dispute.create({
      data: {
        dealId: input.dealId,
        shopId: deal.shopId,
        raisedByUserId: input.userId,
        raisedByParty: party,
        reason: input.reason,
        details,
      },
    });

    this.logger.log(
      `Dispute ${dispute.id} raised by ${party} on deal ${input.dealId} (shop ${deal.shopId}): ${input.reason}`,
    );
    return dispute;
  }

  /**
   * Which side of the deal this user is on — and a 403 if they are on neither.
   * The role from the token is not enough: it says what kind of account this
   * is, not that this account was in this deal.
   */
  private async partyFor(
    deal: { customerUserId: string; shopId: string },
    userId: string,
    role: 'customer' | 'shop_owner',
  ): Promise<DisputeParty> {
    if (role === 'customer') {
      if (deal.customerUserId !== userId)
        throw new ForbiddenException('Not your deal');
      return 'customer';
    }

    const shop = await this.prisma.db.shop.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (!shop || shop.id !== deal.shopId) {
      throw new ForbiddenException('This deal does not belong to your shop');
    }
    return 'shop_owner';
  }

  private withinWindow(createdAt: Date): boolean {
    const ms = DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - createdAt.getTime() <= ms;
  }

  /**
   * What the deal screen needs to decide whether to offer the button, and
   * which reasons to offer. Returned per-viewer, so the shop owner and the
   * customer each get their own answer.
   */
  async disputeContext(
    dealId: string,
    userId: string,
    role: 'customer' | 'shop_owner',
  ) {
    const deal = await this.prisma.db.deal.findUnique({
      where: { id: dealId },
      select: { id: true, customerUserId: true, shopId: true, createdAt: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const party = await this.partyFor(deal, userId, role);
    const mine = await this.prisma.db.dispute.findUnique({
      where: { dealId_raisedByUserId: { dealId, raisedByUserId: userId } },
    });

    return {
      party,
      reasons: REASONS_BY_PARTY[party],
      reasonsRequiringDetails: REASONS_REQUIRING_DETAILS,
      detailsMinLength: DETAILS_MIN_LENGTH,
      windowDays: DISPUTE_WINDOW_DAYS,
      canRaise: !mine && this.withinWindow(deal.createdAt),
      mine,
    };
  }

  /** Every dispute this user raised, newest first. */
  listMine(userId: string) {
    return this.prisma.db.dispute.findMany({
      where: { raisedByUserId: userId },
      include: DEAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ---------------------------------------------------------------- admin

  async list(opts: ListDisputesOpts = {}) {
    const where = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.shopId ? { shopId: opts.shopId } : {}),
      ...(opts.reason ? { reason: opts.reason } : {}),
    };
    const skip = Math.max(opts.skip ?? 0, 0);
    const take = Math.min(Math.max(opts.take ?? 25, 1), 200);

    const [rows, total] = await Promise.all([
      this.prisma.db.dispute.findMany({
        where,
        include: DEAL_INCLUDE,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.db.dispute.count({ where }),
    ]);

    // A single complaint is noise; a pattern is a decision. Show the admin how
    // many times each shop in this page has been complained about and how many
    // of those were upheld, so they are not judging each row in isolation.
    const shopIds = [...new Set(rows.map((r) => r.shopId))];
    const history = shopIds.length
      ? await this.prisma.db.dispute.groupBy({
          by: ['shopId', 'status'],
          where: { shopId: { in: shopIds } },
          _count: { _all: true },
        })
      : [];

    const byShop = new Map<string, { total: number; upheld: number }>();
    for (const h of history) {
      const entry = byShop.get(h.shopId) ?? { total: 0, upheld: 0 };
      entry.total += h._count._all;
      if (h.status === 'upheld') entry.upheld += h._count._all;
      byShop.set(h.shopId, entry);
    }

    return {
      rows: rows.map((r) => ({
        ...r,
        shopDisputeTotal: byShop.get(r.shopId)?.total ?? 1,
        shopDisputeUpheld: byShop.get(r.shopId)?.upheld ?? 0,
      })),
      total,
      skip,
      take,
    };
  }

  countOpen() {
    return this.prisma.db.dispute.count({ where: { status: 'open' } });
  }

  /**
   * Admin decides whether the complaint stands.
   *
   * The note is mandatory in both directions. "Upheld" is what a later
   * suspension will be justified by and "dismissed" is what the complainant is
   * told, and neither is worth anything without the reasoning attached.
   */
  async resolve(input: {
    disputeId: string;
    outcome: Extract<DisputeStatus, 'upheld' | 'dismissed'>;
    note: string;
    resolvedByUserId: string;
  }) {
    const note = input.note?.trim() ?? '';
    if (note.length < 5) {
      throw new BadRequestException(
        'Record why this decision was made (at least 5 characters).',
      );
    }

    const dispute = await this.prisma.db.dispute.findUnique({
      where: { id: input.disputeId },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status !== 'open') {
      throw new BadRequestException(
        `This dispute was already ${dispute.status}.`,
      );
    }

    return this.prisma.db.dispute.update({
      where: { id: input.disputeId },
      data: {
        status: input.outcome,
        resolutionNote: note,
        resolvedByUserId: input.resolvedByUserId,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Complaint history for one shop, for the verify/suspend decision.
   */
  async shopSummary(shopId: string) {
    const [grouped, recent] = await Promise.all([
      this.prisma.db.dispute.groupBy({
        by: ['status'],
        where: { shopId },
        _count: { _all: true },
      }),
      this.prisma.db.dispute.findMany({
        where: { shopId },
        include: DEAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const count = (status: DisputeStatus) =>
      grouped.find((g) => g.status === status)?._count._all ?? 0;

    return {
      open: count('open'),
      upheld: count('upheld'),
      dismissed: count('dismissed'),
      total: grouped.reduce((n, g) => n + g._count._all, 0),
      recent,
    };
  }
}
