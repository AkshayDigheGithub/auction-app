"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { CLERK_ENABLED } from "@/lib/clerk";

// Nothing here is worth generating ahead of time: the page exists for a few
// hundred milliseconds inside a popup, and everything it does needs a browser.
export const dynamic = "force-dynamic";

/**
 * Where Clerk's OAuth popup lands on the way back from Google. This finishes
 * the handshake and closes the popup; the login screen — still open in the
 * parent window — then sees an active session and exchanges it for one of our
 * own tokens.
 */
function ClerkCallback() {
  return <AuthenticateWithRedirectCallback />;
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
