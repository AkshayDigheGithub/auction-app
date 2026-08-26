import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { BidsService } from '../bids/bids.service';
import { RequestsService } from '../requests/requests.service';
import { PaymentsService } from '../payments/payments.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { signQrToken, verifyQrToken } from './qr.util';

// Spec §10 leaves the exact commission % as an open pilot decision — 2% mirrors
// Razorpay's flat domestic rate mentioned in §6 as a sane MVP default.
const COMMISSION_RATE = 0.02;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bidsService: BidsService,
    private readonly requestsService: RequestsService,
    private readonly paymentsService: PaymentsService,
    private readonly gateway: RealtimeGateway,
  ) {}

  /** Customer locks a bid (AUC-12), generating the signed QR deal token (AUC-25). */
  async lockDeal(customerUserId: string, requestId: string, bidId: string) {
    const request = await this.prisma.db.request.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.customerUserId !== customerUserId) throw new ForbiddenException('Not your request');
    if (request.status !== 'open') throw new BadRequestException('Request is no longer open');

    const bid = await this.prisma.db.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.requestId !== requestId) throw new NotFoundException('Bid not found for this request');
    if (bid.status !== 'active') throw new BadRequestException('Bid is no longer active');

    const dealId = randomUUID();
    const qrToken = signQrToken(dealId);

    const deal = await this.prisma.db.deal.create({
      data: {
        id: dealId,
        requestId,
        bidId,
        customerUserId,
        shopId: bid.shopId,
        finalPrice: bid.price,
        qrToken,
      },
    });

    await this.bidsService.settleBidsForRequest(requestId, bidId);
    await this.requestsService.markLocked(requestId);
    this.gateway.broadcastDealLocked(requestId, deal);

    return deal;
  }

  async getDeal(dealId: string, requesterUserId: string) {
    const deal = await this.prisma.db.deal.findUnique({ where: { id: dealId }, include: { shop: true } });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.customerUserId !== requesterUserId) throw new ForbiddenException('Not your deal');
    return deal;
  }

  /** Renders the QR the customer shows at the shop (AUC-13). */
  async getQrImage(dealId: string, customerUserId: string) {
    const deal = await this.getDeal(dealId, customerUserId);
    const dataUrl = await QRCode.toDataURL(deal.qrToken);
    return { dataUrl, deal };
  }

  /** Shop owner scans the QR (AUC-26); validates + confirms + triggers commission (AUC-27/29). */
  async scanDeal(shopOwnerUserId: string, token: string) {
    let dealId: string;
    try {
      ({ dealId } = verifyQrToken(token));
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const deal = await this.prisma.db.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException('Deal not found');

    const shop = await this.prisma.db.shop.findUnique({ where: { ownerUserId: shopOwnerUserId } });
    if (!shop || shop.id !== deal.shopId) {
      throw new ForbiddenException('This deal does not belong to your shop');
    }
    if (deal.qrStatus === 'confirmed') throw new BadRequestException('Deal already confirmed');

    await this.prisma.db.deal.update({
      where: { id: dealId },
      data: { qrStatus: 'confirmed', completedAt: new Date() },
    });
    await this.requestsService.markCompleted(deal.requestId);
    // triggerCommission's update includes qrStatus/completedAt from the write above,
    // so this is the fully up-to-date deal — return this one, not the pre-commission snapshot.
    const updated = await this.paymentsService.triggerCommission(
      deal.id,
      deal.shopId,
      Number(deal.finalPrice) * COMMISSION_RATE,
    );

    this.gateway.broadcastDealCompleted(deal.requestId, updated);
    return updated;
  }
}
