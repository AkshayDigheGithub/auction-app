"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useAuth } from "@/lib/auth-context";
import { CLERK_ENABLED } from "@/lib/clerk";

const ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  shop_owner: "Shop Owner",
  admin: "Admin",
};

const logoutClass =
  "text-neutral-400 underline decoration-dotted underline-offset-2 transition hover:text-neutral-600 disabled:opacity-60 dark:hover:text-neutral-200";

/**
 * Signing out has to clear both sessions, and in that order.
 *
 * Dropping only our own token leaves Clerk's session live, so the next tap on
 * "sign in" silently resumes the account that just left — which on a shared
 * phone, common enough among the shop owners this is aimed at, signs the wrong
 * person in.
 *
 * Ordering is the subtle half. This used to clear our token first and fire
 * `signOut()` without waiting, which lost a race it could not win: clearing the
 * token flips `user` to null synchronously, every guarded page's useRequireRole
 * redirects to /login on the very next render, and /login exchanged the
 * still-live Clerk session for a brand-new 30-day token. Local state beats a
 * network round trip every time, so "Log out" reliably signed the user back in
 * with a *longer* session than they started with. Revoking Clerk first, and
 * awaiting it, removes the session /login would have exchanged.
 *
 * If Clerk cannot be reached the session stays put and the error surfaces.
 * Clearing our token anyway would leave exactly the half-signed-out state this
 * function exists to prevent, and quietly re-arm it on the next sign-in.
 */
function ClerkLogout({ onLogout }: { onLogout: () => void }) {
  const { signOut } = useClerk();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await signOut();
    } catch {
      setFailed(true);
      setBusy(false);
      return;
    }
    onLogout();
    // Explicitly, rather than letting the role guard bounce to /login: a
    // deliberate sign-out should land on the role picker, because whoever
    // picks the phone up next need not be the role who put it down.
    router.replace("/");
  }

  return (
    <button type="button" onClick={handleLogout} disabled={busy} className={logoutClass}>
      {busy ? "Logging out…" : failed ? "Retry log out" : "Log out"}
    </button>
  );
}

function PlainLogout({ onLogout }: { onLogout: () => void }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        onLogout();
        router.replace("/");
      }}
      className={logoutClass}
    >
      Log out
    </button>
  );
}

// useClerk() throws outside a ClerkProvider, and the provider is only mounted
// when Clerk is configured. CLERK_ENABLED is a build-time constant, so picking
// the component here keeps each one's hook order stable.
const LogoutButton = CLERK_ENABLED ? ClerkLogout : PlainLogout;

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
      <Link href="/" className="text-base font-bold tracking-tight text-orange-600 dark:text-orange-400">
        mivikto.store
      </Link>
      {user && (
        <div className="flex items-center gap-2 text-xs">
          {user.role === "shop_owner" && (
            <Link
              href="/wallet"
              className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600 transition hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
            >
              Account
            </Link>
          )}
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <LogoutButton onLogout={logout} />
        </div>
      )}
    </header>
  );
}
