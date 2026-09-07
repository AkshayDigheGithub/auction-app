import type { Role } from "./auth-context";

/**
 * Where each role belongs once it is signed in.
 *
 * This lived in two places — app/page.tsx and app/login/page.tsx — and the two
 * copies had already drifted: the landing page sent a shop owner to /nearby
 * while the login screen sent one to /onboard. That meant a returning owner who
 * had completed onboarding months ago was dropped back into the profile form on
 * every single login, and the only ways out were re-submitting it or tapping the
 * logo. Onboarding is a one-time gate (spec §4), not a toll on every sign-in.
 *
 * /nearby is the right answer for both cases, because it already handles the
 * first-time owner itself: it fetches /shops/me and, when there is no profile
 * yet, renders a "Complete shop profile" prompt pointing at /onboard. So the
 * destination does not need to know whether a shop exists — the destination
 * works it out.
 */
const ROLE_HOME: Record<Role, string> = {
  customer: "/request/new",
  shop_owner: "/nearby",
  admin: "/admin",
};

/** The post-sign-in destination for `role`, falling back to the landing page. */
export function homeForRole(role: string): string {
  return ROLE_HOME[role as Role] ?? "/";
}
