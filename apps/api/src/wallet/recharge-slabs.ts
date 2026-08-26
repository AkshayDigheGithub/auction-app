/**
 * Recharge slabs (AUC-49). Bonus credit is funded by taking recharges over UPI,
 * which is near-zero MDR under RBI Zero MDR, instead of cards.
 *
 * Bonus is posted as a separate `bonus` ledger row rather than being folded into
 * the recharge amount, so paid money and gifted money stay tellable apart in
 * reporting — they are not the same thing on a revenue dashboard.
 */
export interface RechargeSlab {
  id: string;
  payPaise: number;
  bonusPaise: number;
  /** Roughly how many electronics deals this covers, for the shop-facing UI. */
  approxDeals: string;
}

export const RECHARGE_SLABS: RechargeSlab[] = [
  { id: 'slab_500', payPaise: 50_000, bonusPaise: 0, approxDeals: '~2' },
  {
    id: 'slab_1000',
    payPaise: 100_000,
    bonusPaise: 10_000,
    approxDeals: '~3-4',
  },
  {
    id: 'slab_2500',
    payPaise: 250_000,
    bonusPaise: 50_000,
    approxDeals: '~10',
  },
];

/** Custom top-ups are allowed above this floor. */
export const MIN_CUSTOM_RECHARGE_PAISE = 50_000; // ₹500

export function findSlab(id: string): RechargeSlab | undefined {
  return RECHARGE_SLABS.find((s) => s.id === id);
}
