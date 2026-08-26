import { Injectable, Logger } from '@nestjs/common';
import type { ChargeCommissionInput, ChargeCommissionResult, PaymentProvider } from '../payment-provider.interface';

/** Dev-mode commission collection: marks it paid instantly, no real charge (AUC-28/29). */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('Payments');

  async chargeCommission(input: ChargeCommissionInput): Promise<ChargeCommissionResult> {
    this.logger.warn(
      `[DEV] RAZORPAY_KEY_ID not set — mock-charging shop ${input.shopId} ₹${input.amount} for deal ${input.dealId}`,
    );
    return { status: 'paid', reference: `mock_${input.dealId}` };
  }
}
