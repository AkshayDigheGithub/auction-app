import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { BidsModule } from '../bids/bids.module';
import { RequestsModule } from '../requests/requests.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletModule } from '../wallet/wallet.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [
    BidsModule,
    RequestsModule,
    RealtimeModule,
    WalletModule,
    PricingModule,
  ],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
