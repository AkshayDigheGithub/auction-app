import { Logger } from '@nestjs/common';

/**
 * Billing mode (BACKLOG-monetization.md §0).
 *
 *   shadow — compute the fee on every locked deal and record it, but debit
 *            nothing and gate nothing. This is the pilot default: it produces
 *            the "would-be revenue" number that decides whether collecting is
 *            worth building for, without charging a single shop.
 *
 *   live   — debit the shop's wallet at lock, gate matching on balance, and
 *            consume the free-trial allowance.
 *
 * The default is deliberately `shadow`. Switching to `live` is a business
 * decision that depends on the GST position (AUC-74) and the wallet refund
 * policy (AUC-75) — not something that should happen by forgetting to set an
 * environment variable.
 */
export type BillingMode = 'shadow' | 'live';

const logger = new Logger('BillingMode');
let warned = false;

export function getBillingMode(): BillingMode {
  const raw = (process.env.BILLING_MODE ?? 'shadow').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw !== 'shadow' && !warned) {
    warned = true;
    logger.warn(
      `Unrecognised BILLING_MODE="${raw}" — falling back to "shadow" (no shop is charged).`,
    );
  }
  return 'shadow';
}

export function isLiveBilling(): boolean {
  return getBillingMode() === 'live';
}
