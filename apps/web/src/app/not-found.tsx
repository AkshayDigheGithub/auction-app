"use client";

import Link from "next/link";
import { useAuth, type Role } from "@/lib/auth-context";
import { LoadingScreen, primaryButtonClass, secondaryButtonClass } from "@/components/ui";

/**
 * App-side 404.
 *
 * Worth having beyond tidiness: this is a PWA, so a stale home-screen icon or a
 * shared deal link that has since been cleaned up lands here rather than in a
 * browser's own error page — and inside an installed PWA there is no address
 * bar to type a way out of. Without a route back, a dead link is a dead end.
 *
 * The way back is role-specific because "home" is not one place here: a
 * customer wants their requests, a shop owner wants nearby demand, and an admin
 * wants the dashboard. Sending everyone to `/` would bounce two of the three.
 */
const HOME_BY_ROLE: Record<Role, { href: string; label: string }> = {
  customer: { href: "/request/mine", label: "Go to my requests" },
  shop_owner: { href: "/nearby", label: "Go to requests near you" },
  admin: { href: "/admin", label: "Go to the dashboard" },
};

export default function NotFound() {
  const { user, ready } = useAuth();

  // `ready` is false until the auth blob is read out of localStorage. Rendering
  // the signed-out branch first would flash "Log in" at a signed-in user.
  if (!ready) return <LoadingScreen />;

  const home = user ? HOME_BY_ROLE[user.role] : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="text-4xl" aria-hidden="true">
        🧭
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          This page does not exist
        </h1>
        <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          The link may be old, or the request or deal it pointed to may have been closed. Your account is fine.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {home ? (
          <>
            <Link href={home.href} className={`${primaryButtonClass} text-center`}>
              {home.label}
            </Link>
            <Link href="/" className={`${secondaryButtonClass} text-center`}>
              Home
            </Link>
          </>
        ) : (
          <Link href="/login" className={`${primaryButtonClass} text-center`}>
            Log in
          </Link>
        )}
      </div>
    </main>
  );
}
