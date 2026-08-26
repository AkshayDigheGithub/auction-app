import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { BID_CACHE } from './bid-cache.interface';
import { InMemoryBidCache } from './in-memory-bid-cache';
import { RedisBidCache } from './redis-bid-cache';

@Module({
  providers: [
    RealtimeGateway,
    {
      provide: BID_CACHE,
      useClass: process.env.REDIS_URL ? RedisBidCache : InMemoryBidCache,
    },
  ],
  exports: [RealtimeGateway, BID_CACHE],
})
export class RealtimeModule {}
