"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "@/lib/auth-context";
import { CLERK_ENABLED, POST_SSO_PATH, hasSsoPending, recallRole } from "@/lib/clerk";

/**
 * Picks a sign-in back up when it has been dropped on the landing page.
 *
 * Every known way for that to happen is now closed off — the `sso()` call names
 * where a completed sign-in lands, the callback route names every branch, and
 * the provider names the defaults — but the failure mode is bad enough to be
 * worth a net under it. A user who ends up here holding a live Clerk session
 * and no token of ours is, from where they are standing, signed out: the
 * landing page asks them to pick a role and sign in, and they have just done
 * both. What is left of the ones we cannot see from here — a redirect
 * configured in the Clerk dashboard, an installed PWA whose trip to Google came
 * back in a different window — lands them exactly there.
 *
 * The landing page is the right place for it, because it is where everything
 * converges: useRequireRole sends a visitor with no session to "/", the header
 * logo points at "/", and "/" is the app's `start_url` when it is launched from
 * the home screen.
 *
 * The recovery is deliberately narrow. It fires only while
 * {@link hasSsoPending} holds — a sign-in this browser started within the last
 * few minutes — and it leaves the marker alone for /login to consume, so it
 * cannot loop. A Clerk session with no pending marker is the shared-phone case
 * the login screen already handles by asking, and this must not pre-empt it:
 * "someone is still signed in on this phone" is not consent to sign them in
 * again.
 */
function ResumeSignIn() {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Both stores have to have settled. Clerk reports `isSignedIn: false` while
    // it hydrates, and reading either too early is how a returning user gets
    // mistaken for a stranger.
    if (!ready || !isLoaded) return;
    // A session of our own is the normal case: the landing page's own effect
    // forwards them by role.
    if (user) return;
    if (!isSignedIn) return;
    if (!hasSsoPending()) return;

    // Carry the role through, for the same reason the SSO return URL does: a
    // brand-new shop owner whose role is lost signs up as a customer.
    const role = recallRole();
    const params = role ? `?${new URLSearchParams({ role })}` : "";
    router.replace(`${POST_SSO_PATH}${params}`);
  }, [ready, isLoaded, isSignedIn, user, router]);

  return null;
}

function NoClerk() {
  return null;
}

/**
 * Clerk's hooks throw outside the ClerkProvider that the same build-time
 * constant gates in app/layout.tsx, so the choice is made once at module level
 * and each component keeps a stable hook order.
 */
export const ResumeClerkSignIn = CLERK_ENABLED ? ResumeSignIn : NoClerk;
