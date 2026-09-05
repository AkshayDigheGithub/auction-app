import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopsService } from '../shops/shops.service';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';
import { DealsService } from '../deals/deals.service';
import { CatalogService } from '../catalog/catalog.service';
import {
  DisputesService,
  type ListDisputesOpts,
} from '../disputes/disputes.service';
import {
  PricingService,
  RATE_SANITY_THRESHOLD_BPS,
  SHOP_CATEGORIES,
  type ShopCategoryName,
} from '../pricing/pricing.service';
import { getBillingMode } from '../pricing/billing-mode';
import { FREE_DEALS_PER_SHOP } from '../deals/billing.constants';

export interface PageOpts {
  skip?: number;
  take?: number;
}

interface ActorContext {
  actorUserId: string;
  ip?: string;
}

function page(opts: PageOpts) {
  return {
    skip: Math.max(opts.skip ?? 0, 0),
    take: Math.min(Math.max(opts.take ?? 50, 1), 200),
  };
}

function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopsService: ShopsService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly deals: DealsService,
    private readonly catalog: CatalogService,
    private readonly disputes: DisputesService,
  ) {}

  // ---------------------------------------------------------------- listings
  // Every list is paginated and filterable. The previous `take: 200` with no
  // filters broke at pilot scale, let alone after it (AUC-71).

  async listRequests(
    opts: PageOpts & {
      q?: string;
      status?: string;
      productCategoryId?: string;
      /** Only requests that reached no shop at all (AUC-59). */
      reachedNobody?: boolean;
      from?: string;
      to?: string;
    } = {},
  ) {
    const where = {
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.productCategoryId
        ? { productCategoryId: opts.productCategoryId }
        : {}),
      // Rows predating the counts are null, not 0 — an unknown reach is not a
      // zero reach, so they stay out of this filter rather than inflating it.
      ...(opts.reachedNobody ? { notifiedShopCount: 0 } : {}),
      ...(opts.q
        ? { productName: { contains: opts.q, mode: 'insensitive' as const } }
        : {}),
      ...(dateRange(opts.from, opts.to)
        ? { createdAt: dateRange(opts.from, opts.to) }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.request.findMany({
        where,
        include: {
          bids: { select: { id: true } },
          deal: { select: { id: true, feeAmountPaise: true, feeStatus: true } },
          customer: {
            select: { id: true, phoneNumber: true, email: true, name: true },
          },
          productCategory: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...page(opts),
      }),
      this.prisma.db.request.count({ where }),
    ]);
    return { rows, total, ...page(opts) };
  }

  async listDeals(
    opts: PageOpts & {
      feeStatus?: string;
      qrStatus?: string;
      category?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const where = {
      ...(opts.feeStatus ? { feeStatus: opts.feeStatus as never } : {}),
      ...(opts.qrStatus ? { qrStatus: opts.qrStatus as never } : {}),
      ...(opts.category ? { feeCategory: opts.category as never } : {}),
      ...(dateRange(opts.from, opts.to)
        ? { createdAt: dateRange(opts.from, opts.to) }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.deal.findMany({
        where,
        include: {
          shop: { select: { id: true, shopName: true, category: true } },
          request: { select: { id: true, productName: true } },
          reversal: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...page(opts),
      }),
      this.prisma.db.deal.count({ where }),
    ]);
    return { rows, total, ...page(opts) };
  }

  async listShops(
    opts: PageOpts & {
      q?: string;
      category?: string;
      lowBalance?: boolean;
      suspended?: boolean;
    } = {},
  ) {
    const where = {
      ...(opts.category ? { category: opts.category as never } : {}),
      ...(opts.suspended != null ? { suspended: opts.suspended } : {}),
      ...(opts.q
        ? {
            OR: [
              { shopName: { contains: opts.q, mode: 'insensitive' as const } },
              { address: { contains: opts.q, mode: 'insensitive' as const } },
              { owner: { phoneNumber: { contains: opts.q } } },
              {
                owner: {
                  email: { contains: opts.q, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.db.shop.findMany({
        where,
        include: {
          owner: {
            select: { id: true, phoneNumber: true, email: true, name: true },
          },
          _count: { select: { bids: true, deals: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...page(opts),
      }),
      this.prisma.db.shop.count({ where }),
    ]);

    // "Low balance" depends on the shop's own category cap, so it is applied
    // after the query rather than as a fixed SQL threshold.
    const withFlags = await Promise.all(
      rows.map(async (s) => {
        const required = await this.pricing
          .maxFeePaise(s.category)
          .catch(() => 0);
        const onTrial = s.freeDealsUsed < FREE_DEALS_PER_SHOP;
        return {
          ...s,
          requiredBalancePaise: required,
          onTrial,
          freeDealsRemaining: Math.max(
            FREE_DEALS_PER_SHOP - s.freeDealsUsed,
            0,
          ),
          lowBalance: !onTrial && s.walletBalancePaise < required,
        };
      }),
    );

    return {
      rows: opts.lowBalance ? withFlags.filter((s) => s.lowBalance) : withFlags,
      total,
      ...page(opts),
    };
  }

  /**
   * Everyone with an account, customers and shop owners alike.
   *
   * Every other listing is keyed on a shop, a request or a deal, which leaves
   * no way to answer "who is this phone number?" — the question support gets
   * first whenever someone calls in. A shop owner with no `shop` is the other
   * thing worth seeing here: they signed up and never finished onboarding.
   */
  async listUsers(
    opts: PageOpts & {
      q?: string;
      role?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const where = {
      ...(opts.role ? { role: opts.role as never } : {}),
      ...(opts.q
        ? {
            OR: [
              { phoneNumber: { contains: opts.q } },
              { email: { contains: opts.q, mode: 'insensitive' as const } },
              { name: { contains: opts.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(dateRange(opts.from, opts.to)
        ? { createdAt: dateRange(opts.from, opts.to) }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        select: {
          id: true,
          phoneNumber: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          shop: {
            select: {
              id: true,
              shopName: true,
              verified: true,
              suspended: true,
            },
          },
          _count: { select: { requests: true, deals: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...page(opts),
      }),
      this.prisma.db.user.count({ where }),
    ]);

    return { rows, total, ...page(opts) };
  }

  // ------------------------------------------------------------- shop detail

  /** Everything about one shop on one page (AUC-67). */
  async shopDetail(shopId: string) {
    const shop = await this.prisma.db.shop.findUnique({
      where: { id: shopId },
      include: {
        owner: {
          select: {
            id: true,
            phoneNumber: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        _count: { select: { bids: true, deals: true } },
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');

    const [ledger, deals, confirmedCount, rule, disputes] = await Promise.all([
      this.wallet.ledger(shopId, { take: 20 }),
      this.prisma.db.deal.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          request: { select: { productName: true } },
          reversal: { select: { status: true } },
        },
      }),
      this.prisma.db.deal.count({ where: { shopId, qrStatus: 'confirmed' } }),
      this.pricing.getRule(shop.category).catch(() => null),
      // Complaint history belongs on this page: verifying or suspending a shop
      // is the decision these disputes exist to inform (AUC-34).
      this.disputes.shopSummary(shopId),
    ]);

    const feesCharged = await this.prisma.db.deal.aggregate({
      where: { shopId, feeStatus: 'charged' },
      _sum: { feeAmountPaise: true },
      _count: { _all: true },
    });

    const lockedCount = shop._count.deals;

    return {
      shop,
      pricing: rule,
      freeDealsRemaining: Math.max(FREE_DEALS_PER_SHOP - shop.freeDealsUsed, 0),
      stats: {
        bids: shop._count.bids,
        dealsLocked: lockedCount,
        dealsConfirmed: confirmedCount,
        // The shop-quality signal that used to be a revenue dependency (AUC-68).
        lockToConfirmRatio: lockedCount ? confirmedCount / lockedCount : null,
        feesChargedPaise: feesCharged._sum.feeAmountPaise ?? 0,
        chargedDeals: feesCharged._count._all,
      },
      disputes,
      recentLedger: ledger.rows,
      recentDeals: deals,
    };
  }

  // ------------------------------------------------------------ shop actions

  async setShopVerified(shopId: string, verified: boolean, ctx: ActorContext) {
    const before = await this.prisma.db.shop.findUnique({
      where: { id: shopId },
    });
    if (!before) throw new NotFoundException('Shop not found');
    const after = await this.shopsService.setVerified(shopId, verified);
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: verified ? 'shop.verify' : 'shop.unverify',
      targetType: 'shop',
      targetId: shopId,
      before: { verified: before.verified },
      after: { verified: after.verified },
      ip: ctx.ip,
    });
    return after;
  }

  /** Suspension takes effect immediately at match time and is reversible (AUC-67). */
  async setShopSuspended(
    shopId: string,
    suspended: boolean,
    reason: string | null,
    ctx: ActorContext,
  ) {
    const before = await this.prisma.db.shop.findUnique({
      where: { id: shopId },
    });
    if (!before) throw new NotFoundException('Shop not found');
    if (suspended && (!reason || reason.trim().length < 5)) {
      throw new BadRequestException(
        'A reason of at least 5 characters is required to suspend a shop',
      );
    }

    const after = await this.prisma.db.shop.update({
      where: { id: shopId },
      data: { suspended, suspendedReason: suspended ? reason!.trim() : null },
    });
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: suspended ? 'shop.suspend' : 'shop.unsuspend',
      targetType: 'shop',
      targetId: shopId,
      before: { suspended: before.suspended, reason: before.suspendedReason },
      after: { suspended: after.suspended, reason: after.suspendedReason },
      ip: ctx.ip,
    });
    return after;
  }

  /** Category edits are admin-only because they change the fee (AUC-62). */
  async updateShopCategories(
    shopId: string,
    input: {
      category?: ShopCategoryName;
      secondaryCategories?: ShopCategoryName[];
    },
    ctx: ActorContext,
  ) {
    const before = await this.prisma.db.shop.findUnique({
      where: { id: shopId },
    });
    if (!before) throw new NotFoundException('Shop not found');

    const all = [
      ...(input.category ? [input.category] : []),
      ...(input.secondaryCategories ?? []),
    ];
    const unknown = all.filter((c) => !SHOP_CATEGORIES.includes(c));
    if (unknown.length)
      throw new BadRequestException(
        `Unknown categories: ${unknown.join(', ')}`,
      );

    const after = await this.prisma.db.shop.update({
      where: { id: shopId },
      data: {
        ...(input.category ? { category: input.category } : {}),
        ...(input.secondaryCategories
          ? { secondaryCategories: input.secondaryCategories }
          : {}),
      },
    });
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: 'shop.categories.update',
      targetType: 'shop',
      targetId: shopId,
      before: {
        category: before.category,
        secondaryCategories: before.secondaryCategories,
      },
      after: {
        category: after.category,
        secondaryCategories: after.secondaryCategories,
      },
      ip: ctx.ip,
    });
    return after;
  }

  // ----------------------------------------------------------------- wallet

  /** Manual credit/debit — support's day-one tool (AUC-64). */
  async adjustWallet(
    shopId: string,
    input: { amountPaise: number; reason: string },
    ctx: ActorContext,
  ) {
    const before = await this.prisma.db.shop.findUnique({
      where: { id: shopId },
      select: { walletBalancePaise: true },
    });
    if (!before) throw new NotFoundException('Shop not found');

    const txn = await this.wallet.adjust({
      shopId,
      amountPaise: input.amountPaise,
      reason: input.reason,
      actorUserId: ctx.actorUserId,
    });

    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: 'wallet.adjust',
      targetType: 'shop',
      targetId: shopId,
      before: { balancePaise: before.walletBalancePaise },
      after: {
        balancePaise: txn.balanceAfterPaise,
        amountPaise: input.amountPaise,
        reason: input.reason,
      },
      ip: ctx.ip,
    });
    return txn;
  }

  shopLedger(
    shopId: string,
    opts: PageOpts & { type?: string; from?: string; to?: string } = {},
  ) {
    return this.wallet.ledger(shopId, {
      type: opts.type as never,
      from: opts.from ? new Date(opts.from) : undefined,
      to: opts.to ? new Date(opts.to) : undefined,
      ...page(opts),
    });
  }

  walletTotals() {
    return this.wallet.platformTotals();
  }

  // ------------------------------------------------------------------ rates

  async listRates() {
    const rates = await this.pricing.listRates();
    return rates.map((r) => ({
      ...r,
      preview: this.pricing.preview({
        rateBps: r.rateBps,
        capPaise: r.capPaise,
        floorPaise: r.floorPaise,
        flatFeePaise: r.flatFeePaise,
      }),
    }));
  }

  async updateRate(
    category: ShopCategoryName,
    input: {
      rateBps?: number;
      capPaise?: number | null;
      floorPaise?: number;
      flatFeePaise?: number | null;
      active?: boolean;
      confirmHighRate?: boolean;
    },
    ctx: ActorContext,
  ) {
    // A rate this high is almost certainly a typo (5% vs 0.5%). Charging it
    // would take most of a shop's margin, so it needs a deliberate confirm.
    if (
      input.rateBps != null &&
      input.rateBps > RATE_SANITY_THRESHOLD_BPS &&
      !input.confirmHighRate
    ) {
      throw new BadRequestException(
        `${(input.rateBps / 100).toFixed(2)}% is above the ${RATE_SANITY_THRESHOLD_BPS / 100}% sanity threshold. Re-submit with confirmHighRate to apply it.`,
      );
    }

    // confirmHighRate is a guard rail on the request, not a stored field.
    const data = { ...input };
    delete data.confirmHighRate;
    const { before, after } = await this.pricing.updateRate(category, data);

    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: 'rate.update',
      targetType: 'commission_rate',
      targetId: category,
      before,
      after,
      ip: ctx.ip,
    });
    return after;
  }

  // ---------------------------------------------------------------- revenue

  /**
   * Revenue dashboard v2 (AUC-69). Replaces the old single-number summary.
   *
   * Fees earned, wallet float and trial cost are three different numbers and are
   * deliberately returned separately — float is a liability (service owed), not
   * revenue, and conflating them would overstate the business.
   */
  async revenueSummary(opts: { from?: string; to?: string } = {}) {
    const createdAt = dateRange(opts.from, opts.to);
    const where = createdAt ? { createdAt } : {};

    const [charged, shadow, trial, reversed, byCategory, totals, activeShops] =
      await Promise.all([
        this.prisma.db.deal.aggregate({
          where: { ...where, feeStatus: 'charged' },
          _sum: { feeAmountPaise: true },
          _count: { _all: true },
          _avg: { feeAmountPaise: true },
        }),
        // The pilot's headline number: what we WOULD have earned (AUC-47).
        this.prisma.db.deal.aggregate({
          where: { ...where, feeStatus: 'shadow' },
          _sum: { feeAmountPaise: true },
          _count: { _all: true },
        }),
        this.prisma.db.deal.aggregate({
          where: { ...where, feeStatus: 'waived_trial' },
          _sum: { feeAmountPaise: true },
          _count: { _all: true },
        }),
        this.prisma.db.deal.aggregate({
          where: { ...where, feeStatus: 'reversed' },
          _sum: { feeAmountPaise: true },
          _count: { _all: true },
        }),
        this.prisma.db.deal.groupBy({
          by: ['feeCategory'],
          where,
          _sum: { feeAmountPaise: true },
          _count: { _all: true },
        }),
        this.wallet.platformTotals(),
        this.prisma.db.shop.count({ where: { suspended: false } }),
      ]);

    const chargedPaise = charged._sum.feeAmountPaise ?? 0;
    const shadowPaise = shadow._sum.feeAmountPaise ?? 0;

    return {
      billingMode: getBillingMode(),
      // Actually earned.
      feesEarnedPaise: chargedPaise,
      chargedDeals: charged._count._all,
      averageFeePaise: Math.round(charged._avg.feeAmountPaise ?? 0),
      // Would have earned, had billing been live. The number the day-30
      // decision gate turns on.
      wouldBeRevenuePaise: shadowPaise,
      shadowDeals: shadow._count._all,
      // Acquisition spend, not lost revenue.
      trialWaivedPaise: trial._sum.feeAmountPaise ?? 0,
      trialDeals: trial._count._all,
      // A deduction line of its own.
      reversedPaise: reversed._sum.feeAmountPaise ?? 0,
      reversedDeals: reversed._count._all,
      byCategory,
      wallet: totals,
      activeShops,
      // Spec §8 running-cost band, for context on the dashboard.
      monthlyCostBandPaise: { low: 250_000, high: 1_200_000 },
    };
  }

  /** Fee totals bucketed by day, for the revenue trend (AUC-69). */
  async revenueByDay(days = 30) {
    return this.prisma.db.$queryRaw<
      Array<{
        day: Date;
        charged_paise: bigint;
        shadow_paise: bigint;
        deals: bigint;
      }>
    >`
      SELECT date_trunc('day', created_at) AS day,
             COALESCE(SUM(fee_amount_paise) FILTER (WHERE fee_status = 'charged'), 0) AS charged_paise,
             COALESCE(SUM(fee_amount_paise) FILTER (WHERE fee_status = 'shadow'), 0) AS shadow_paise,
             COUNT(*) AS deals
      FROM deals
      WHERE created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  // ---------------------------------------------------------------- leakage

  /**
   * Lock-to-confirm ratio per shop (AUC-68).
   *
   * Revenue no longer depends on the QR scan, so this is now a quality signal
   * rather than a leakage risk: a shop with lots of locks and few confirms is
   * either closing off-platform or not delivering.
   */
  async leakageByShop(opts: { days?: number; minDeals?: number } = {}) {
    const days = opts.days ?? 30;
    const minDeals = opts.minDeals ?? 1;
    return this.prisma.db.$queryRaw<
      Array<{
        shop_id: string;
        shop_name: string;
        locked: bigint;
        confirmed: bigint;
        reversed: bigint;
        confirm_ratio: number | null;
      }>
    >`
      SELECT s.id AS shop_id, s.shop_name,
             COUNT(d.id) AS locked,
             COUNT(*) FILTER (WHERE d.qr_status = 'confirmed') AS confirmed,
             COUNT(*) FILTER (WHERE d.fee_status = 'reversed') AS reversed,
             CASE WHEN COUNT(d.id) = 0 THEN NULL
                  ELSE COUNT(*) FILTER (WHERE d.qr_status = 'confirmed')::float / COUNT(d.id)
             END AS confirm_ratio
      FROM shops s
      JOIN deals d ON d.shop_id = s.id
      WHERE d.created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY s.id, s.shop_name
      HAVING COUNT(d.id) >= ${minDeals}
      ORDER BY confirm_ratio ASC NULLS LAST, locked DESC
    `;
  }

  /** Platform-wide confirm rate over time. */
  async leakageTrend(days = 30) {
    return this.prisma.db.$queryRaw<
      Array<{ day: Date; locked: bigint; confirmed: bigint }>
    >`
      SELECT date_trunc('day', created_at) AS day,
             COUNT(*) AS locked,
             COUNT(*) FILTER (WHERE qr_status = 'confirmed') AS confirmed
      FROM deals
      WHERE created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  // -------------------------------------------------------------- reversals

  async listReversals(opts: PageOpts & { status?: string } = {}) {
    const where = opts.status ? { status: opts.status as never } : {};
    const [rows, total] = await Promise.all([
      this.prisma.db.dealReversal.findMany({
        where,
        include: {
          deal: {
            include: {
              shop: { select: { id: true, shopName: true } },
              request: { select: { productName: true } },
              customer: {
                select: {
                  id: true,
                  phoneNumber: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...page(opts),
      }),
      this.prisma.db.dealReversal.count({ where }),
    ]);

    // Flag customers who report everything — either a bad actor or a broken
    // funnel, and admin needs to be able to tell (AUC-70).
    const counts = await this.prisma.db.dealReversal.groupBy({
      by: ['reportedByUserId'],
      _count: { _all: true },
    });
    const byUser = new Map(
      counts.map((c) => [c.reportedByUserId, c._count._all]),
    );

    return {
      rows: rows.map((r) => ({
        ...r,
        reporterTotalReports: byUser.get(r.reportedByUserId) ?? 1,
      })),
      total,
      ...page(opts),
    };
  }

  async approveReversal(reversalId: string, note: string, ctx: ActorContext) {
    const result = await this.deals.approveReversal(
      reversalId,
      ctx.actorUserId,
      note || 'Approved by admin',
    );
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: 'reversal.approve',
      targetType: 'reversal',
      targetId: reversalId,
      after: { note, dealId: result.dealId },
      ip: ctx.ip,
    });
    return result;
  }

  async rejectReversal(reversalId: string, note: string, ctx: ActorContext) {
    const result = await this.deals.rejectReversal(
      reversalId,
      ctx.actorUserId,
      note,
    );
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: 'reversal.reject',
      targetType: 'reversal',
      targetId: reversalId,
      after: { note, dealId: result.dealId },
      ip: ctx.ip,
    });
    return result;
  }

  // --------------------------------------------------------------- disputes

  listDisputes(opts: ListDisputesOpts = {}) {
    return this.disputes.list(opts);
  }

  countOpenDisputes() {
    return this.disputes.countOpen();
  }

  /**
   * Uphold or dismiss a complaint (AUC-34).
   *
   * Audited like every other privileged action: an upheld dispute is what a
   * later suspension gets justified by, so who decided it and why has to
   * survive longer than anyone's memory.
   */
  async resolveDispute(
    disputeId: string,
    outcome: 'upheld' | 'dismissed',
    note: string,
    ctx: ActorContext,
  ) {
    const result = await this.disputes.resolve({
      disputeId,
      outcome,
      note,
      resolvedByUserId: ctx.actorUserId,
    });
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: outcome === 'upheld' ? 'dispute.uphold' : 'dispute.dismiss',
      targetType: 'dispute',
      targetId: disputeId,
      after: {
        outcome,
        note,
        dealId: result.dealId,
        shopId: result.shopId,
      },
      ip: ctx.ip,
    });
    return result;
  }

  // ------------------------------------------------------- product catalog

  listProductCategories() {
    return this.catalog.listAllWithUsage();
  }

  async createProductCategory(
    input: Parameters<CatalogService['create']>[0],
    ctx: ActorContext,
  ) {
    const created = await this.catalog.create(input);
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: 'product_category.create',
      targetType: 'product_category',
      targetId: created.id,
      after: created,
      ip: ctx.ip,
    });
    return created;
  }

  async updateProductCategory(
    id: string,
    input: Parameters<CatalogService['update']>[1],
    ctx: ActorContext,
  ) {
    const { before, after } = await this.catalog.update(id, input);
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: 'product_category.update',
      targetType: 'product_category',
      targetId: id,
      before,
      after,
      ip: ctx.ip,
    });
    return after;
  }

  async setProductCategoryActive(
    id: string,
    active: boolean,
    ctx: ActorContext,
  ) {
    const { before, after } = await this.catalog.setActive(id, active);
    await this.audit.record({
      actorUserId: ctx.actorUserId,
      action: active
        ? 'product_category.update'
        : 'product_category.deactivate',
      targetType: 'product_category',
      targetId: id,
      before: { active: before.active },
      after: { active: after.active },
      ip: ctx.ip,
    });
    return after;
  }

  // ------------------------------------------------------------ trial cohort

  /**
   * Trial → recharge conversion (AUC-73).
   *
   * If shops finish their free deals and never top up, the problem is the price
   * or the lead quality — and it shows up here long before it shows up in
   * revenue.
   */
  async trialCohorts() {
    const shops = await this.prisma.db.shop.findMany({
      select: {
        id: true,
        shopName: true,
        createdAt: true,
        freeDealsUsed: true,
        walletBalancePaise: true,
        _count: { select: { deals: true } },
      },
    });

    const rechargedShopIds = new Set(
      (
        await this.prisma.db.walletTransaction.groupBy({
          by: ['shopId'],
          where: { type: 'recharge' },
        })
      ).map((r) => r.shopId),
    );

    const inTrial: typeof shops = [];
    const converted: typeof shops = [];
    const lapsed: typeof shops = [];

    for (const s of shops) {
      const trialDone = s.freeDealsUsed >= FREE_DEALS_PER_SHOP;
      if (!trialDone) inTrial.push(s);
      else if (rechargedShopIds.has(s.id)) converted.push(s);
      else lapsed.push(s);
    }

    const finishedTrial = converted.length + lapsed.length;
    return {
      freeDealsPerShop: FREE_DEALS_PER_SHOP,
      inTrial: { count: inTrial.length, shops: inTrial },
      converted: { count: converted.length, shops: converted },
      lapsed: { count: lapsed.length, shops: lapsed },
      // The single clearest indicator of whether the price is right.
      conversionRate: finishedTrial ? converted.length / finishedTrial : null,
    };
  }

  // ---------------------------------------------------------------- audit

  auditLog(
    opts: PageOpts & {
      actorUserId?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    return this.audit.list({
      actorUserId: opts.actorUserId,
      action: opts.action as never,
      targetType: opts.targetType,
      targetId: opts.targetId,
      from: opts.from ? new Date(opts.from) : undefined,
      to: opts.to ? new Date(opts.to) : undefined,
      ...page(opts),
    });
  }
}
