/**
 * Conduct disputes (AUC-34). Shared between the customer's deal page and the
 * admin queue so both sides name a complaint the same way — an admin reading
 * "Price was higher in the shop" should be reading the customer's own words,
 * not a second translation of an enum.
 */

export type DisputeReason =
  | "bid_not_honoured"
  | "price_higher_in_shop"
  | "item_not_available"
  | "shop_unreachable"
  | "customer_no_show"
  | "conduct"
  | "other";

export type DisputeStatus = "open" | "upheld" | "dismissed";

export type DisputeParty = "customer" | "shop_owner";

/** What the person raising it picks from. */
export const DISPUTE_REASON_LABEL: Record<DisputeReason, string> = {
  bid_not_honoured: "The shop wouldn't honour its bid",
  price_higher_in_shop: "The price was higher in the shop",
  item_not_available: "The item wasn't actually available",
  shop_unreachable: "I couldn't reach the shop",
  customer_no_show: "The customer never came",
  conduct: "Rude or unprofessional behaviour",
  other: "Something else",
};

/** Terser wording for table cells, where the row already carries the context. */
export const DISPUTE_REASON_SHORT: Record<DisputeReason, string> = {
  bid_not_honoured: "Bid not honoured",
  price_higher_in_shop: "Price higher in shop",
  item_not_available: "Item unavailable",
  shop_unreachable: "Shop unreachable",
  customer_no_show: "Customer no-show",
  conduct: "Conduct",
  other: "Other",
};

export const DISPUTE_STATUS_TONE = {
  open: "amber",
  upheld: "red",
  dismissed: "neutral",
} as const;

export interface Dispute {
  id: string;
  reason: DisputeReason;
  details: string | null;
  status: DisputeStatus;
  raisedByParty: DisputeParty;
  createdAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
}
