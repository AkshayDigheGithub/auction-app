/**
 * Money helpers. The API speaks integer paise for anything wallet- or
 * fee-related; the UI is the only place it becomes rupees.
 */

export function formatPaise(paise: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  if (paise == null) return "—";
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })}`;
}

export function formatRupees(rupees: number | string | null | undefined): string {
  if (rupees == null) return "—";
  return `₹${Number(rupees).toLocaleString("en-IN")}`;
}

/** 60 bps -> "0.6%" */
export function formatBps(bps: number | null | undefined): string {
  if (bps == null) return "—";
  return `${(bps / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;
}

export const SHOP_CATEGORY_LABELS: Record<string, string> = {
  mobile_electronics: "Mobile & Electronics",
  computers: "Computers",
  appliances: "Home Appliances",
  hardware: "Hardware & Building",
  auto_parts: "Auto Parts",
  furniture: "Furniture",
  apparel: "Apparel & Footwear",
  jewellery: "Jewellery",
  grocery: "Grocery",
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "—";
  return SHOP_CATEGORY_LABELS[category] ?? category;
}

/**
 * How the fee is described to a shop owner. Leads with the cap rather than the
 * percentage: "never more than ₹300" removes the anxious mental arithmetic on a
 * ₹70,000 sale in a way that "0.6%" does not.
 */
export function describeFee(pricing: {
  rateBps: number | null;
  capPaise: number | null;
  flatFeePaise: number | null;
}): string {
  if (pricing.flatFeePaise != null) return `${formatPaise(pricing.flatFeePaise)} per deal`;
  const rate = formatBps(pricing.rateBps);
  return pricing.capPaise != null ? `${rate}, never more than ${formatPaise(pricing.capPaise)}` : rate;
}

export const FEE_STATUS_LABELS: Record<string, string> = {
  shadow: "Not charged (pilot)",
  waived_trial: "Free trial",
  charged: "Charged",
  reversed: "Reversed",
};

export const TXN_TYPE_LABELS: Record<string, string> = {
  recharge: "Top-up",
  deal_fee: "Deal fee",
  reversal: "Reversal",
  bonus: "Bonus",
  admin_credit: "Manual credit",
  admin_debit: "Manual debit",
  trial_waiver: "Free trial",
};
