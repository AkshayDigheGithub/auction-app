"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  shop_owner: "Shop Owner",
  admin: "Admin",
};

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
      <Link href="/" className="text-base font-bold tracking-tight text-orange-600 dark:text-orange-400">
        Nearby Bids
      </Link>
      {user && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <button
            type="button"
            onClick={logout}
            className="text-neutral-400 underline decoration-dotted underline-offset-2 transition hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
