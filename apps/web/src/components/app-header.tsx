"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useAuth } from "@/lib/auth-context";
import { CLERK_ENABLED } from "@/lib/clerk";

const ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  shop_owner: "Shop Owner",
  admin: "Admin",
};

const logoutClass =
  "text-neutral-400 underline decoration-dotted underline-offset-2 transition hover:text-neutral-600 dark:hover:text-neutral-200";

/**
 * Signing out has to clear both sessions. Dropping only our own token leaves
 * Clerk's session live, so the next tap on "sign in" silently resumes the
 * account that just left — which on a shared phone, common enough among the
 * shop owners this is aimed at, signs the wrong person in.
 */
function ClerkLogout({ onLogout }: { onLogout: () => void }) {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => {
        onLogout();
        void signOut();
      }}
      className={logoutClass}
    >
      Log out
    </button>
  );
}

function PlainLogout({ onLogout }: { onLogout: () => void }) {
  return (
    <button type="button" onClick={onLogout} className={logoutClass}>
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
        Nearby Bids
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
