import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';

@Module({
  providers: [
    PaymentsService,
    MockPaymentProvider,
    RazorpayPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (razorpay: RazorpayPaymentProvider, mock: MockPaymentProvider) =>
        process.env.RAZORPAY_KEY_ID ? razorpay : mock,
      inject: [RazorpayPaymentProvider, MockPaymentProvider],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
