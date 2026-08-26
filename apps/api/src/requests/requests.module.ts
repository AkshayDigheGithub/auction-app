import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { GeoModule } from '../geo/geo.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [GeoModule, RealtimeModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
