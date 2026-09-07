import type {
  DisputeParty,
  DisputeReason,
} from '../../generated/prisma/client.js';

/**
 * How long after a deal is locked either side can raise a conduct dispute
 * (AUC-34).
 *
 * Deliberately longer than the 72-hour billing reversal window. A reversal has
 * to close quickly because it moves money; "the shop wouldn't honour its bid"
 * usually only gets reported after the customer has spent days waiting for the
 * shop to make it right on its own.
 */
export const DISPUTE_WINDOW_DAYS = 14;

/**
 * Which reasons each side may give.
 *
 * Split rather than shared so the data stays worth counting: without this a
 * shop could file `bid_not_honoured` against itself, and the per-shop
 * complaint count that the Verified badge leans on would mean nothing.
 */
export const REASONS_BY_PARTY: Record<DisputeParty, readonly DisputeReason[]> =
  {
    customer: [
      'bid_not_honoured',
      'price_higher_in_shop',
      'item_not_available',
      'shop_unreachable',
      'conduct',
      'other',
    ],
    shop_owner: ['customer_no_show', 'conduct', 'other'],
  };

/** Reasons that need the free-text box filled in to be actionable. */
export const REASONS_REQUIRING_DETAILS: readonly DisputeReason[] = [
  'conduct',
  'other',
];

export const DETAILS_MIN_LENGTH = 10;
