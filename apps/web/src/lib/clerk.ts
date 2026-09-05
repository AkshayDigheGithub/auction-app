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
 * Sign-in uses Clerk's *popup* OAuth flow rather than the redirect flow. The
 * app is installed with `display: "standalone"` (see app/manifest.ts), and a
 * full-page redirect launched from a standalone window can hand the user off
 * to the system browser and never come back — leaving them signed in somewhere
 * they cannot see.
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
