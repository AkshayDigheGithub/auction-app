import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { BidsModule } from '../bids/bids.module';
import { RequestsModule } from '../requests/requests.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [BidsModule, RequestsModule, PaymentsModule, RealtimeModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
