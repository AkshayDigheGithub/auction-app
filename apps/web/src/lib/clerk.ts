/**
 * Clerk configuration for the web app (AUC-88).
 *
 * Clerk is the front door only, with Google as the single enabled provider.
 * It proves who the user is once; the session the app then runs on is our own
 * 30-day JWT, minted by POST /auth/clerk/verify. That split is deliberate:
 * Clerk's own tokens live about a minute and need a live refresh, which is the
 * wrong property for an installed PWA on Indian mobile networks — a shop owner
 * opening the app on a bad connection should stay signed in.
 *
 * Sign-in uses Clerk's redirect flow. The popup flow was tried first, because
 * the app is installed with `display: "standalone"` (see app/manifest.ts) and a
 * full-page redirect from a standalone window can in principle hand the user
 * off to the system browser and not come back.
 *
 * It did not work. The popup completed the handshake and the session was
 * created, but the window that opened it never learned about it, so the login
 * screen sat there while the popup ended up on the app — signed in, in the
 * wrong window. A second attempt then opened a blank popup, because sso() will
 * not start a sign-in while a session is already active.
 *
 * The redirect flow has no cross-window step to get wrong: the page navigates
 * away, comes back to /sso-callback, and /login remounts with Clerk hydrated
 * from cookies. The standalone-PWA concern is real but unproven, and worth
 * re-testing on a real Android install rather than designing around blind.
 */

export const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Whether to offer Clerk sign-in at all. Unset locally, so development can keep
 * the phone OTP flow and needs no Clerk account.
 */
export const CLERK_ENABLED = Boolean(CLERK_PUBLISHABLE_KEY);

/** Where Clerk's OAuth popup lands before handing control back to the app. */
export const SSO_CALLBACK_PATH = "/sso-callback";

/**
 * The same route as an absolute URL.
 *
 * `signIn.sso()` parses these parameters with the URL constructor, which has no
 * base to resolve against and throws on a bare path — "/sso-callback cannot be
 * parsed as a URL". The older `authenticateWithRedirect` accepted relative
 * paths, so this is easy to carry over wrong.
 *
 * Deliberately built from `window.location.origin` rather than a configured
 * value: the app is served from several hostnames (the custom domain, the
 * Vercel production alias, and a preview URL per branch), and an origin pinned
 * to any one of them sends the popup back to a different site than the one that
 * opened it.
 */
export function ssoCallbackUrl(): string {
  return `${window.location.origin}${SSO_CALLBACK_PATH}`;
}

/**
 * The role the user picked, parked across the OAuth round trip.
 *
 * The redirect flow leaves the origin and comes back to /sso-callback, which
 * has no idea which button started it — so `?role=` is gone by the time we
 * exchange the session. That matters only for a first-time user, but it
 * matters a lot: `issueSession` reads the role from an existing row, so
 * losing it signs a brand-new shop owner up as a customer.
 *
 * sessionStorage rather than the callback URL: it survives a same-tab
 * navigation away and back, and does not depend on Clerk preserving query
 * parameters through the handshake. Wrapped because it throws outright in a
 * browser set to block site data.
 */
const ROLE_KEY = "clerk:pending-role";

export function rememberRole(role: string): void {
  try {
    sessionStorage.setItem(ROLE_KEY, role);
  } catch {
    // Non-fatal: the caller falls back to the role in the URL.
  }
}

export function recallRole(): string | null {
  try {
    return sessionStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

export function forgetRole(): void {
  try {
    sessionStorage.removeItem(ROLE_KEY);
  } catch {
    // Nothing to clean up if it was never written.
  }
}
