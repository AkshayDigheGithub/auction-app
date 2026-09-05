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
 * The consequence of that split runs through everything below: a Clerk session
 * on its own signs nobody into this app. Only /login exchanges one for a token
 * we accept, so any sign-in that ends up somewhere other than /login leaves the
 * user signed in with Clerk and signed out of the app — which looks exactly
 * like being dumped back on the landing page and asked to log in again.
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
 * away, comes back to /login, and /login remounts with Clerk hydrated from
 * cookies. The standalone-PWA concern is real but unproven, and worth
 * re-testing on a real Android install rather than designing around blind —
 * the storage below is written so that it survives even if that hand-off does
 * happen.
 */

export const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Whether to offer Clerk sign-in at all. Unset locally, so development can keep
 * the phone OTP flow and needs no Clerk account.
 */
export const CLERK_ENABLED = Boolean(CLERK_PUBLISHABLE_KEY);

/**
 * Where a sign-in that could *not* be completed comes back to, to be finished
 * off — Clerk's `redirectCallbackUrl`. A first-time Google account lands here,
 * because the account on our side still has to be created.
 */
export const SSO_CALLBACK_PATH = "/sso-callback";

/**
 * Where a sign-in that *was* completed comes back to — Clerk's `redirectUrl`.
 *
 * This has to be named, and named as the login screen, because /login is the
 * only place that exchanges a Clerk session for one of our tokens. Leaving it
 * unset does not mean "come back where you started": Clerk then falls back
 * through its own chain — the instance's configured redirect, then a built-in
 * default of "/" — and "/" is the marketing landing page. A sign-in that ends
 * there has a live Clerk session, no token of ours, and a landing page asking
 * the user to pick a role and sign in all over again. That was the bug.
 */
export const POST_SSO_PATH = "/login";

/**
 * The SSO routes as absolute URLs.
 *
 * `signIn.sso()` parses these parameters with the URL constructor, which has no
 * base to resolve against and throws on a bare path — "/sso-callback cannot be
 * parsed as a URL". The older `authenticateWithRedirect` accepted relative
 * paths, so this is easy to carry over wrong.
 *
 * Deliberately built from `window.location.origin` rather than a configured
 * value: the app is served from several hostnames (the custom domain, the
 * Vercel production alias, and a preview URL per branch), and an origin pinned
 * to any one of them sends the user back to a different site than the one they
 * started on.
 */
export function ssoCallbackUrl(): string {
  return `${window.location.origin}${SSO_CALLBACK_PATH}`;
}

/**
 * Carries the role in the URL as well as in storage, so a first-time user still
 * signs up as the role they picked even on a browser that dropped the storage
 * below. /login reads it as the fallback to {@link recallRole}.
 */
export function postSsoUrl(role: string): string {
  const params = new URLSearchParams({ role });
  return `${window.location.origin}${POST_SSO_PATH}?${params}`;
}

/**
 * The two facts that have to survive the round trip to Google: which role the
 * user picked, and that they asked for a sign-in at all.
 *
 * Both were in sessionStorage, and sessionStorage is the wrong store for
 * something that has to outlive a full-page navigation to another origin. It
 * is scoped to the browsing context, and the context is exactly what an OAuth
 * redirect can lose: an installed PWA (`display: "standalone"`) may hand the
 * trip to Google off to a Custom Tab or the system browser, and what comes back
 * is a fresh context with an empty store. The Clerk session survives — it is a
 * cookie — so the user returns signed in to Clerk, unrecognised by this screen,
 * and is asked to confirm a sign-in they already completed.
 *
 * localStorage survives that. What it gives up is the natural expiry a browsing
 * context has, so the expiry is written down instead: a record older than
 * {@link SSO_TTL_MS} is treated as absent. That keeps the property these keys
 * exist for — only a sign-in the user *just* asked for is finished
 * automatically — while letting the round trip take as long as typing a
 * password on Google's screen actually takes.
 */
const SSO_TTL_MS = 10 * 60 * 1000;

type StampedRecord = { value: string; at: number };

/** Wrapped throughout: storage throws outright in a browser set to block site data. */
function writeStamped(key: string, value: string): void {
  try {
    const record: StampedRecord = { value, at: Date.now() };
    localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Non-fatal: every caller has a fallback that asks the user instead.
  }
}

/** The stored value, or null if it is missing, unreadable, or too old to trust. */
function readStamped(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<StampedRecord>;
    if (typeof record.value !== "string" || typeof record.at !== "number") {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - record.at > SSO_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return record.value;
  } catch {
    return null;
  }
}

function clearStamped(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up if it was never written.
  }
}

/**
 * The role the user picked, parked across the OAuth round trip.
 *
 * The redirect flow leaves the origin and comes back, and the screen it comes
 * back to has no idea which button started it. That matters only for a
 * first-time user, but it matters a lot: `issueSession` reads the role from an
 * existing row, so losing it signs a brand-new shop owner up as a customer.
 */
const ROLE_KEY = "clerk:pending-role";

export function rememberRole(role: string): void {
  writeStamped(ROLE_KEY, role);
}

export function recallRole(): string | null {
  return readStamped(ROLE_KEY);
}

export function forgetRole(): void {
  clearStamped(ROLE_KEY);
}

/**
 * A one-shot marker that *this* browser started an SSO redirect.
 *
 * Without it, the login screen keyed its exchange on Clerk's ambient
 * `isSignedIn`, which treats "Clerk happens to have a session" as consent to
 * sign in. Clerk's session cookie outlives the ~60s access token by days, so
 * that was true on essentially every return visit to /login, not just the one
 * moment after a redirect. Three things fell out of it:
 *
 *   - the back button could never leave /login: it remounted, saw a session,
 *     exchanged again and pushed forward;
 *   - a stale session signed in whoever last used the phone, with no prompt;
 *   - logging out bounced through /login and got a fresh 30-day token.
 *
 * Set immediately before handing off to Clerk and consumed exactly once on the
 * way back, so the automatic exchange happens only for a sign-in the user
 * actually just asked for. Everything else has to go through a visible tap.
 */
const SSO_PENDING_KEY = "clerk:sso-pending";

export function markSsoPending(): void {
  writeStamped(SSO_PENDING_KEY, "1");
}

/** True only for the first read after {@link markSsoPending}. */
export function consumeSsoPending(): boolean {
  const pending = readStamped(SSO_PENDING_KEY) === "1";
  clearStamped(SSO_PENDING_KEY);
  return pending;
}

/**
 * Whether a sign-in is still waiting to be finished, without claiming it.
 *
 * For screens that can only route the user to /login rather than complete the
 * exchange themselves — they have to leave the marker for /login to consume.
 */
export function hasSsoPending(): boolean {
  return readStamped(SSO_PENDING_KEY) === "1";
}

/** Drops both markers. For a sign-in that failed before it ever left. */
export function forgetSso(): void {
  clearStamped(SSO_PENDING_KEY);
  clearStamped(ROLE_KEY);
}
