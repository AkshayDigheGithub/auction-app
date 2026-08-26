import { Module } from '@nestjs/common';
import { ShopsService } from './shops.service';
import { ShopsController } from './shops.controller';
import { GeoModule } from '../geo/geo.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [GeoModule, PushModule],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
