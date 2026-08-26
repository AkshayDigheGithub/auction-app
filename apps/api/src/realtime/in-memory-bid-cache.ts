import { Injectable, Logger } from '@nestjs/common';
import type { BidCache } from './bid-cache.interface';

const TTL_MS = 60_000;

/** Fallback bid cache used when REDIS_URL is unset — fine for single-instance dev (AUC-23). */
@Injectable()
export class InMemoryBidCache implements BidCache {
  private readonly logger = new Logger('BidCache');
  private readonly store = new Map<string, { data: unknown[]; expiresAt: number }>();
  private warned = false;

  async getBids(requestId: string): Promise<unknown[] | null> {
    if (!this.warned) {
      this.logger.warn('REDIS_URL not set — using in-memory bid cache (single-instance only).');
      this.warned = true;
    }
    const entry = this.store.get(requestId);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.data;
  }

  async setBids(requestId: string, bids: unknown[]): Promise<void> {
    this.store.set(requestId, { data: bids, expiresAt: Date.now() + TTL_MS });
  }

  async invalidate(requestId: string): Promise<void> {
    this.store.delete(requestId);
  }
}
