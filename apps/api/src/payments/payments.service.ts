import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.interface';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Triggered at QR-scan confirmation — the verifiable billing moment (AUC-29). */
  async triggerCommission(dealId: string, shopId: string, amount: number) {
    const result = await this.provider.chargeCommission({ dealId, shopId, amount });
    return this.prisma.db.deal.update({
      where: { id: dealId },
      data: {
        commissionAmount: amount,
        commissionStatus: result.status === 'paid' ? 'paid' : 'pending',
      },
    });
  }
}
