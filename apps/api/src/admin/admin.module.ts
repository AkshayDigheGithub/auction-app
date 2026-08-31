import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ShopsModule } from '../shops/shops.module';
import { WalletModule } from '../wallet/wallet.module';
import { PricingModule } from '../pricing/pricing.module';
import { AuditModule } from '../audit/audit.module';
import { DealsModule } from '../deals/deals.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DisputesModule } from '../disputes/disputes.module';

@Module({
  imports: [
    ShopsModule,
    WalletModule,
    PricingModule,
    AuditModule,
    DealsModule,
    CatalogModule,
    DisputesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
