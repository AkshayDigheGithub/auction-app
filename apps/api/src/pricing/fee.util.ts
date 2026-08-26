/**
 * Fee calculation (AUC-51). Pure and side-effect free so it can be unit-tested
 * without a database — this is the one piece of arithmetic that decides what
 * every shop pays, so it gets tested directly rather than through the API.
 *
 * All money here is integer paise. Never floats: 0.1 + 0.2 problems in a ledger
 * are extremely hard to find later.
 */

export interface FeeRule {
  /** Basis points. 60 = 0.60%. Ignored when flatFeePaise is set. */
  rateBps: number;
  /** Upper bound per deal, or null for uncapped. */
  capPaise: number | null;
  /** Lower bound per deal. */
  floorPaise: number;
  /** When set, the fee is exactly this and rate/cap/floor are ignored. */
  flatFeePaise: number | null;
}

export interface FeeQuote {
  amountPaise: number;
  /** Snapshot of the inputs, stored on the deal so history stays interpretable. */
  rateBps: number;
  capPaise: number | null;
}

export function rupeesToPaise(rupees: number | string): number {
  // Deal.finalPrice is a Decimal(10,2) that arrives as a string. Parse via
  // string manipulation rather than float maths to avoid rounding drift.
  const n = typeof rupees === 'string' ? Number(rupees) : rupees;
  if (!Number.isFinite(n))
    throw new Error(`Invalid rupee amount: ${String(rupees)}`);
  return Math.round(n * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Format paise as a plain rupee string for logs and admin display. */
export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The fee a shop owes for winning a deal of `pricePaise`.
 *
 * Flat-fee categories (grocery) short-circuit: a percentage of a ₹300 basket
 * isn't worth billing, so those pay a fixed amount instead.
 *
 * Otherwise: rate, then floor, then cap. The fee can never exceed the deal
 * value itself — a ₹15 sale must not attract a ₹20 floor.
 */
export function computeFee(pricePaise: number, rule: FeeRule): FeeQuote {
  if (!Number.isInteger(pricePaise) || pricePaise < 0) {
    throw new Error(
      `pricePaise must be a non-negative integer, got ${pricePaise}`,
    );
  }

  if (rule.flatFeePaise != null) {
    return {
      amountPaise: Math.min(rule.flatFeePaise, pricePaise),
      rateBps: 0,
      capPaise: null,
    };
  }

  let amount = Math.round((pricePaise * rule.rateBps) / 10_000);
  amount = Math.max(amount, rule.floorPaise);
  if (rule.capPaise != null) amount = Math.min(amount, rule.capPaise);
  amount = Math.min(amount, pricePaise);

  return {
    amountPaise: Math.max(amount, 0),
    rateBps: rule.rateBps,
    capPaise: rule.capPaise,
  };
}
