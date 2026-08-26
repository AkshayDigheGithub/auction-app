/**
 * Free trial (AUC-52): the first N deals a shop wins cost nothing.
 *
 * A counter rather than a calendar. A time-based trial punishes shops in slow
 * areas during the cold start and needs expiry jobs, grace periods and dunning;
 * a counter self-adjusts to how fast demand actually arrives and is one integer.
 *
 * It is also the better pitch — the shop has already made money three times
 * before it pays anything. Cost to the platform is roughly ₹750 of forgone fees
 * per shop, which is cheap customer acquisition.
 *
 * 3 is a judgement call, not a derived number. Worth revisiting once ~50 shops
 * have been through it (see the trial cohort view, AUC-73).
 */
export const FREE_DEALS_PER_SHOP = 3;

/**
 * How long a customer has to report "I didn't buy" and get the shop's fee
 * credited back (AUC-54).
 */
export const REVERSAL_WINDOW_HOURS = 72;

/**
 * Reversals at or below this are auto-approved. Contesting ₹180 costs more in
 * support time than it recovers (AUC-70).
 */
export const REVERSAL_AUTO_APPROVE_MAX_PAISE = 30_000; // ₹300
