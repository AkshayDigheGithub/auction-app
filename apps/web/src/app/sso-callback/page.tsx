"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { CLERK_ENABLED, POST_SSO_PATH } from "@/lib/clerk";

// Nothing here is worth generating ahead of time: the page exists for a few
// hundred milliseconds mid-redirect, and everything it does needs a browser.
export const dynamic = "force-dynamic";

/**
 * Where a Google sign-in that could *not* complete comes back to — Clerk's
 * `redirectCallbackUrl`. A completed one goes straight to {@link POST_SSO_PATH}
 * and never touches this route; see the `sso()` call in app/login/page.tsx.
 *
 * Every branch below lands on /login, because /login is the only screen that
 * exchanges a Clerk session for one of our own tokens. A flow that ends
 * anywhere else ends signed in with Clerk and signed out of the app, which
 * presents as the landing page asking the user to sign in a second time.
 *
 * Naming all of them is the point. Clerk fills in whatever is left unset from
 * its own chain — the instance's dashboard configuration, then the routes of a
 * mounted `<SignIn />` component (this app has none, it drives sign-in from its
 * own button), then a built-in default of "/". "/" is the marketing landing
 * page. So the ones left unset were precisely the ones that could strand a user
 * there, and which of them came up depended on the account: a plain sign-in and
 * a first-time sign-up do not resolve the same way, which is why it went wrong
 * only sometimes.
 *
 * Force rather than fallback for the two completion cases: a fallback yields to
 * any `redirect_url` already in the path, and dashboard configuration can put
 * one there.
 */
function ClerkCallback() {
  return (
    <AuthenticateWithRedirectCallback
      // Completed here rather than at redirectUrl — take control of both.
      signInForceRedirectUrl={POST_SSO_PATH}
      signUpForceRedirectUrl={POST_SSO_PATH}
      signInFallbackRedirectUrl={POST_SSO_PATH}
      signUpFallbackRedirectUrl={POST_SSO_PATH}
      // The "needs another step" routes. Clerk points these at subpaths of a
      // mounted <SignIn />/<SignUp /> by default, and there is none to point
      // at, so each would otherwise resolve to a route this app does not serve.
      signInUrl={POST_SSO_PATH}
      signUpUrl={POST_SSO_PATH}
      firstFactorUrl={POST_SSO_PATH}
      secondFactorUrl={POST_SSO_PATH}
      resetPasswordUrl={POST_SSO_PATH}
      continueSignUpUrl={POST_SSO_PATH}
      verifyEmailAddressUrl={POST_SSO_PATH}
      verifyPhoneNumberUrl={POST_SSO_PATH}
    />
  );
}

/**
 * Without a publishable key there is no ClerkProvider mounted (see AuthShell in
 * app/layout.tsx) and no SSO flow that could have landed here, so rendering the
 * callback would only throw. Gated on the same build-time constant as the
 * provider itself, so the two can never disagree.
 */
function NoClerk() {
  return null;
}

const Body = CLERK_ENABLED ? ClerkCallback : NoClerk;

export default function SsoCallbackPage() {
  return <Body />;
}
