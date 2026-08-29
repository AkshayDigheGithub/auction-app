import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SharedJwtModule } from './common/shared-jwt.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { GeoModule } from './geo/geo.module';
import { ShopsModule } from './shops/shops.module';
import { RequestsModule } from './requests/requests.module';
import { RealtimeModule } from './realtime/realtime.module';
import { BidsModule } from './bids/bids.module';
import { DealsModule } from './deals/deals.module';
import { DisputesModule } from './disputes/disputes.module';
import { AdminModule } from './admin/admin.module';
import { PricingModule } from './pricing/pricing.module';
import { WalletModule } from './wallet/wallet.module';
import { AuditModule } from './audit/audit.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedJwtModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    GeoModule,
    ShopsModule,
    RequestsModule,
    RealtimeModule,
    BidsModule,
    PricingModule,
    WalletModule,
    AuditModule,
    CatalogModule,
    DealsModule,
    DisputesModule,
    AdminModule,
  ],
})
export class AppModule {}
