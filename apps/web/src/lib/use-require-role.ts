"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type Role } from "./auth-context";
import { homeForRole } from "./role-routes";

/**
 * Sends the user somewhere sensible unless they hold one of `roles`.
 *
 * The two failure cases used to share a destination — /login?role=<the role
 * this page wants> — and neither was well served by it.
 *
 * No session at all now goes to the role picker. With nothing signed in there
 * is no evidence the visitor holds the role this page happens to require, and
 * after a sign-out on a shared phone they frequently do not. It also makes the
 * post-logout destination deterministic: the header navigates to "/" and this
 * guard agrees, so the two cannot race each other for it.
 *
 * A session with the wrong role goes to that role's own home. Showing a signed-
 * in user a login form is a dead end — the exchange behind it resolves to the
 * role they already have (issueSession ignores the requested role for an
 * existing user), so it could only ever deposit them back where they started,
 * having said nothing about why.
 */
export function useRequireRole(...roles: Role[]) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(homeForRole(user.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, router]);

  return { user, ready };
}
