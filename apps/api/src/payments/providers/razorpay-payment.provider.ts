import { Injectable, Logger } from '@nestjs/common';
import type { ChargeCommissionInput, ChargeCommissionResult, PaymentProvider } from '../payment-provider.interface';

/**
 * Razorpay commission collection (AUC-28/29). This creates a standard order
 * for the commission amount as a starting point — wiring the shop owner's
 * UPI/bank details through Razorpay Route for automatic splitting is a
 * follow-up once a real Razorpay account with Route enabled exists.
 */
@Injectable()
export class RazorpayPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('Payments');

  async chargeCommission(input: ChargeCommissionInput): Promise<ChargeCommissionResult> {
    const keyId = process.env.RAZORPAY_KEY_ID as string;
    const keySecret = process.env.RAZORPAY_KEY_SECRET as string;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100), // paise
        currency: 'INR',
        receipt: input.dealId,
        notes: { shopId: input.shopId, dealId: input.dealId },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Razorpay order creation failed (${res.status}): ${body}`);
      return { status: 'pending' };
    }

    const order = await res.json();
    return { status: 'pending', reference: order.id };
  }
}
