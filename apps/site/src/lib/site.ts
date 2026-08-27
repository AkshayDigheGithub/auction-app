/**
 * Single source of truth for anything that differs between environments or
 * that a non-developer may need to correct without hunting through components.
 */

/**
 * Where the actual product lives. In production this is the app subdomain; the
 * marketing site is on the apex. Locally it is the dev server on :3000.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * PLACEHOLDER — the pilot city is still an open decision (spec §10, item 1).
 *
 * Deliberately not a real city name: a launch deadline must not be what forces
 * a city into public copy. Set this once the decision is actually made; until
 * then the coverage section says we are onboarding without naming a place.
 */
export const PILOT_CITY: string | null = null;

/**
 * PLACEHOLDER — replace before this site goes public.
 *
 * This audience trusts a voice on the phone, not a contact form. A number that
 * nobody answers is worse than no number at all, so this must be a line that is
 * actually staffed.
 */
export const CONTACT_PHONE = "+91 00000 00000";
export const CONTACT_EMAIL = "hello@example.com";

/**
 * Anchors on the single homepage rather than separate routes.
 *
 * Both audiences have thin, overlapping content at pilot stage — one city, one
 * category, no live billing. Two landing pages would mean two half-empty pages
 * and double the FAQ and legal surface to keep in sync. Split later if the
 * scroll data actually asks for it.
 */
export const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#for-shops", label: "For shop owners" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;
