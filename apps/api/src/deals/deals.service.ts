import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { BidsService } from '../bids/bids.service';
import { RequestsService } from '../requests/requests.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  WalletService,
  InsufficientBalanceError,
} from '../wallet/wallet.service';
import {
  PricingService,
  type ShopCategoryName,
} from '../pricing/pricing.service';
import { formatPaise, rupeesToPaise } from '../pricing/fee.util';
import { getBillingMode } from '../pricing/billing-mode';
import { signQrToken, verifyQrToken } from './qr.util';
import type { Deal } from '../../generated/prisma/client.js';
import {
  FREE_DEALS_PER_SHOP,
  REVERSAL_AUTO_APPROVE_MAX_PAISE,
  REVERSAL_WINDOW_HOURS,
} from './billing.constants';

@Injectable()
export class DealsService {
  private readonly logger = new Logger('DealsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly bidsService: BidsService,
    private readonly requestsService: RequestsService,
    private readonly wallet: WalletService,
    private readonly pricing: PricingService,
    private readonly gateway: RealtimeGateway,
  ) {}

  /**
   * Which category's rate applies to this deal (AUC-60).
   *
   * The rate follows the *request*, not the shop's primary category. Otherwise a
   * shop could register as `jewellery` (0.30%) and take electronics deals at a
   * third of the correct rate.
   */
  private resolveFeeCategory(
    shopCategory: ShopCategoryName,
    shopSecondary: ShopCategoryName[],
    productCategoryShopCategories: ShopCategoryName[] | null,
  ): ShopCategoryName {
    if (!productCategoryShopCategories?.length) return shopCategory;

    // Prefer the shop's primary when the request could be served by it.
    if (productCategoryShopCategories.includes(shopCategory))
      return shopCategory;

    // Otherwise the first category the shop actually serves.
    const served = productCategoryShopCategories.find((c) =>
      shopSecondary.includes(c),
    );
    return served ?? productCategoryShopCategories[0] ?? shopCategory;
  }

  /**
   * Customer locks a bid (AUC-12), generating the signed QR deal token (AUC-25)
   * and charging the shop's fee (AUC-50).
   *
   * The fee is charged HERE, not at QR scan. Locking is a customer action inside
   * our app, so the shop cannot suppress it; the QR scan is a shop action the
   * shop has every incentive to skip when it carries a bill. Deal creation and
   * the wallet debit share one transaction — a failed debit must not leave an
   * orphan deal, and a created deal must not leave an uncharged shop.
   */
  async lockDeal(customerUserId: string, requestId: string, bidId: string) {
    const request = await this.prisma.db.request.findUnique({
      where: { id: requestId },
      include: { productCategory: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.customerUserId !== customerUserId)
      throw new ForbiddenException('Not your request');
    if (request.status !== 'open')
      throw new BadRequestException('Request is no longer open');

    const bid = await this.prisma.db.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.requestId !== requestId)
      throw new NotFoundException('Bid not found for this request');
    if (bid.status !== 'active')
      throw new BadRequestException('Bid is no longer active');

    const shop = await this.prisma.db.shop.findUnique({
      where: { id: bid.shopId },
    });
    if (!shop) throw new NotFoundException('Shop not found for this bid');

    const feeCategory = this.resolveFeeCategory(
      shop.category,
      shop.secondaryCategories ?? [],
      request.productCategory?.shopCategories ?? null,
    );

    const pricePaise = rupeesToPaise(bid.price.toString());
    const quote = await this.pricing.quote(feeCategory, pricePaise);

    const billingMode = getBillingMode();
    const onTrial = shop.freeDealsUsed < FREE_DEALS_PER_SHOP;
    const dealId = randomUUID();
    const qrToken = signQrToken(dealId);

    // shadow  — record what the fee would have been, charge nothing (pilot default)
    // trial   — inside the free allowance, charge nothing but consume one
    // charged — debit the wallet
    const feeStatus =
      billingMode === 'shadow'
        ? 'shadow'
        : onTrial
          ? 'waived_trial'
          : 'charged';

    let deal: Deal;
    try {
      deal = await this.prisma.db.$transaction(async (tx) => {
        const created = await tx.deal.create({
          data: {
            id: dealId,
            requestId,
            bidId,
            customerUserId,
            shopId: bid.shopId,
            finalPrice: bid.price,
            qrToken,
            feeAmountPaise: quote.amountPaise,
            feeRateBps: quote.rateBps,
            feeCapPaise: quote.capPaise,
            feeCategory,
            feeStatus,
          },
        });

        if (feeStatus === 'charged') {
          await this.wallet.debit(
            {
              shopId: bid.shopId,
              type: 'deal_fee',
              amountPaise: quote.amountPaise,
              dealId,
              reason: `Deal fee — ${request.productName}`,
            },
            tx,
          );
        } else if (feeStatus === 'waived_trial') {
          // A zero-value ledger row on purpose: the trial has to be visible in
          // the ledger, otherwise "why was this deal free?" has no answer, and
          // the trial's cost as acquisition spend can't be totalled (AUC-69).
          await this.wallet.post(
            {
              shopId: bid.shopId,
              type: 'trial_waiver',
              amountPaise: 0,
              dealId,
              reason: `Free trial deal ${shop.freeDealsUsed + 1} of ${FREE_DEALS_PER_SHOP} — ${request.productName} (waived ${formatPaise(quote.amountPaise)})`,
            },
            tx,
          );
          await tx.shop.update({
            where: { id: bid.shopId },
            data: { freeDealsUsed: { increment: 1 } },
          });
        }

        return created;
      });
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        throw new BadRequestException(
          'This shop can no longer accept deals — its account balance has run out. Please choose another bid.',
        );
      }
      throw err;
    }

    await this.bidsService.settleBidsForRequest(requestId, bidId);
    await this.requestsService.markLocked(requestId);
    this.gateway.broadcastDealLocked(requestId, deal);

    this.logger.log(
      `Deal ${dealId} locked: shop ${bid.shopId}, ${formatPaise(pricePaise)} @ ${quote.rateBps}bps ` +
        `-> fee ${formatPaise(quote.amountPaise)} [${feeStatus}]`,
    );

    return deal;
  }

  async getDeal(dealId: string, requesterUserId: string) {
    const deal = await this.prisma.db.deal.findUnique({
      where: { id: dealId },
      include: { shop: true, reversal: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.customerUserId !== requesterUserId)
      throw new ForbiddenException('Not your deal');
    return {
      ...deal,
      canReport:
        this.withinReversalWindow(deal.createdAt) &&
        !deal.reversal &&
        deal.qrStatus !== 'confirmed',
    };
  }

  private withinReversalWindow(createdAt: Date): boolean {
    return (
      Date.now() - createdAt.getTime() <= REVERSAL_WINDOW_HOURS * 60 * 60 * 1000
    );
  }

  /** Renders the QR the customer shows at the shop (AUC-13). */
  async getQrImage(dealId: string, customerUserId: string) {
    const deal = await this.getDeal(dealId, customerUserId);
    const dataUrl = await QRCode.toDataURL(deal.qrToken);
    return { dataUrl, deal };
  }

  /**
   * Shop owner scans the QR (AUC-26).
   *
   * This no longer charges anything (AUC-56). Its job now is confirmation and
   * trust: it produces the customer's receipt, unlocks rating, and gives admin
   * the lock-to-confirm ratio as a shop-quality signal. Revenue no longer
   * depends on a step the paying party controls.
   */
  async scanDeal(shopOwnerUserId: string, token: string) {
    let dealId: string;
    try {
      ({ dealId } = verifyQrToken(token));
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const deal = await this.prisma.db.deal.findUnique({
      where: { id: dealId },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const shop = await this.prisma.db.shop.findUnique({
      where: { ownerUserId: shopOwnerUserId },
    });
    if (!shop || shop.id !== deal.shopId) {
      throw new ForbiddenException('This deal does not belong to your shop');
    }
    if (deal.qrStatus === 'confirmed')
      throw new BadRequestException('Deal already confirmed');

    const updated = await this.prisma.db.deal.update({
      where: { id: dealId },
      data: { qrStatus: 'confirmed', completedAt: new Date() },
      include: { shop: true },
    });
    await this.requestsService.markCompleted(deal.requestId);

    this.gateway.broadcastDealCompleted(deal.requestId, updated);
    return updated;
  }

  /**
   * Customer reports they didn't buy, within the reversal window (AUC-54).
   *
   * This is the safety valve that makes lock-time billing fair — without it a
   * shop pays for a customer who never showed up. Small reversals are
   * auto-approved because contesting them costs more than they recover; the
   * rest land in the admin queue (AUC-70).
   */
  async reportNoPurchase(
    customerUserId: string,
    dealId: string,
    reason: string,
  ) {
    const deal = await this.prisma.db.deal.findUnique({
      where: { id: dealId },
      include: { reversal: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.customerUserId !== customerUserId)
      throw new ForbiddenException('Not your deal');
    if (deal.reversal)
      throw new BadRequestException('You have already reported this deal');
    if (deal.qrStatus === 'confirmed') {
      throw new BadRequestException(
        'This deal was confirmed in the shop and cannot be reported',
      );
    }
    if (!this.withinReversalWindow(deal.createdAt)) {
      throw new BadRequestException(
        `Reports must be made within ${REVERSAL_WINDOW_HOURS} hours of choosing the shop.`,
      );
    }
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('Please tell us briefly what happened');
    }

    const reversal = await this.prisma.db.dealReversal.create({
      data: {
        dealId,
        reportedByUserId: customerUserId,
        reason: reason.trim(),
        status: 'pending',
      },
    });

    const feePaise = deal.feeAmountPaise ?? 0;
    if (feePaise <= REVERSAL_AUTO_APPROVE_MAX_PAISE) {
      return this.approveReversal(
        reversal.id,
        null,
        'Auto-approved: below manual review threshold',
      );
    }
    return reversal;
  }

  /**
   * Credit the fee back to the shop's wallet (AUC-54 / AUC-70).
   *
   * Credit, never a bank refund — reconciling a ₹300 bank transfer costs more
   * than the ₹300 itself, and the shop would rather have the leads anyway.
   *
   * `resolvedByUserId` is null for auto-approvals.
   */
  async approveReversal(
    reversalId: string,
    resolvedByUserId: string | null,
    note: string,
  ) {
    const reversal = await this.prisma.db.dealReversal.findUnique({
      where: { id: reversalId },
      include: { deal: true },
    });
    if (!reversal) throw new NotFoundException('Reversal not found');
    if (reversal.status !== 'pending') {
      throw new BadRequestException(
        `This report was already ${reversal.status}`,
      );
    }

    const deal = reversal.deal;
    const feePaise = deal.feeAmountPaise ?? 0;

    return this.prisma.db.$transaction(async (tx) => {
      // Only a fee that was actually taken can be given back. Shadow and trial
      // deals were never charged, so there is nothing to credit — but the
      // reversal still resolves, and a trial deal gives its free slot back.
      if (deal.feeStatus === 'charged' && feePaise > 0) {
        await this.wallet.credit(
          {
            shopId: deal.shopId,
            type: 'reversal',
            amountPaise: feePaise,
            dealId: deal.id,
            reason: `Reversal — customer reported no purchase`,
            createdByUserId: resolvedByUserId ?? undefined,
          },
          tx,
        );
      }

      if (deal.feeStatus === 'waived_trial') {
        // A reversed trial deal must not burn one of the shop's free deals —
        // it never delivered the value the trial is meant to demonstrate.
        await tx.shop.update({
          where: { id: deal.shopId },
          data: { freeDealsUsed: { decrement: 1 } },
        });
      }

      await tx.deal.update({
        where: { id: deal.id },
        data: { feeStatus: 'reversed' },
      });

      return tx.dealReversal.update({
        where: { id: reversalId },
        data: {
          status: 'approved',
          resolvedByUserId,
          resolvedAt: new Date(),
          resolutionNote: note,
        },
      });
    });
  }

  async rejectReversal(
    reversalId: string,
    resolvedByUserId: string,
    note: string,
  ) {
    const reversal = await this.prisma.db.dealReversal.findUnique({
      where: { id: reversalId },
    });
    if (!reversal) throw new NotFoundException('Reversal not found');
    if (reversal.status !== 'pending') {
      throw new BadRequestException(
        `This report was already ${reversal.status}`,
      );
    }
    if (!note || note.trim().length < 5) {
      throw new BadRequestException(
        'A reason of at least 5 characters is required to reject a report',
      );
    }

    return this.prisma.db.dealReversal.update({
      where: { id: reversalId },
      data: {
        status: 'rejected',
        resolvedByUserId,
        resolvedAt: new Date(),
        resolutionNote: note.trim(),
      },
    });
  }
}
