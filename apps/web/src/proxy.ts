import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Runs Clerk on the server for every document request (AUC-88).
 *
 * Next 16 renamed this file convention from `middleware` to `proxy`; the
 * function signature and `config` export are unchanged, so Clerk's
 * `clerkMiddleware()` — written for the old name — slots straight in. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 *
 * Why it exists at all, given that every sign-in decision in this app happens
 * in the browser: without it, Clerk boots on the client knowing nothing, and
 * has to work out whether there is a session by asking its API after hydration.
 * Every screen that reads `isSignedIn` therefore sees `false` first and the
 * truth a moment later, which is the flicker /login spends an entire effect
 * defending against ("`isSignedIn` is false while it is still hydrating"). With
 * this in place the session is resolved before the page is sent, so the first
 * client render already knows the answer.
 *
 * It also runs Clerk's handshake, which is what refreshes a session cookie
 * whose short-lived token has expired. That is the difference between a shop
 * owner reopening the installed app after a week and finding themselves signed
 * in, versus finding themselves back at the landing page.
 */
const clerk = clerkMiddleware();

/**
 * Both keys, and the secret is the one that bites.
 *
 * `clerkMiddleware()` verifies sessions itself, so it needs CLERK_SECRET_KEY —
 * and this app has never had one. The secret belongs to apps/api, which is
 * where every Clerk session token has been redeemed until now; the browser side
 * only ever needed the publishable key. Left ungated, a deployment carrying
 * just the publishable key throws "Missing secretKey" on the proxy, which is
 * every request: the whole site 500s, signed in or not.
 *
 * So this stays off until someone sets CLERK_SECRET_KEY on the web app too, and
 * without it the app runs exactly as it did before — Clerk resolved in the
 * browser, sessions redeemed by the API. Nothing here is load-bearing for
 * sign-in; it removes the hydration flicker described above, and there is no
 * combination of the two keys that leaves the app broken.
 *
 * Read from `process.env` directly rather than importing CLERK_ENABLED from
 * lib/clerk: this file runs in the proxy runtime, and pulling in a module that
 * also carries browser storage helpers would drag them along for the ride.
 */
const CLERK_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export default CLERK_CONFIGURED ? clerk : () => NextResponse.next();

export const config = {
  /**
   * Everything except the things Clerk has no business seeing: Next's own build
   * output, the service worker and its manifest (they are fetched by the
   * browser outside any navigation, and a handshake redirect on `/sw.js` would
   * break registration), and static files under public/.
   */
  matcher: [
    "/((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|favicon\\.ico|.*\\.(?:png|svg|ico|json|txt|xml|webmanifest)$).*)",
  ],
};
