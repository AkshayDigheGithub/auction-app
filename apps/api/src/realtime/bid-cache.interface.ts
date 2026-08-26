export interface BidCache {
  getBids(requestId: string): Promise<unknown[] | null>;
  setBids(requestId: string, bids: unknown[]): Promise<void>;
  invalidate(requestId: string): Promise<void>;
}

export const BID_CACHE = Symbol('BID_CACHE');
