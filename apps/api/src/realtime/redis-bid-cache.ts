import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { BidCache } from './bid-cache.interface';

const TTL_SECONDS = 60;

/** Redis-backed bid cache (AUC-23) — active when REDIS_URL is set (e.g. Upstash). */
@Injectable()
export class RedisBidCache implements BidCache, OnModuleDestroy {
  private readonly logger = new Logger('BidCache');
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL as string);
    this.logger.log('Using Redis-backed bid cache.');
  }

  private key(requestId: string) {
    return `bids:${requestId}`;
  }

  async getBids(requestId: string): Promise<unknown[] | null> {
    const raw = await this.client.get(this.key(requestId));
    return raw ? JSON.parse(raw) : null;
  }

  async setBids(requestId: string, bids: unknown[]): Promise<void> {
    await this.client.set(this.key(requestId), JSON.stringify(bids), 'EX', TTL_SECONDS);
  }

  async invalidate(requestId: string): Promise<void> {
    await this.client.del(this.key(requestId));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
