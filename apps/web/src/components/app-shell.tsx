"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The app is a phone-shaped column by default — that is right for customers and
 * shop owners, who are on a handset in a shop.
 *
 * Admin is the exception: it is a dashboard with tables, and squeezing it into
 * 448px on a laptop wastes most of the screen. This widens the shell for
 * `/admin` only, so the two audiences each get the layout that suits them.
 */
const WIDE_ROUTES = ["/admin"];

const BASE =
  "mx-auto flex min-h-screen w-full flex-col bg-white shadow-sm sm:my-4 sm:min-h-0 sm:rounded-2xl sm:border sm:border-neutral-100 dark:bg-neutral-900 dark:shadow-none dark:sm:border-neutral-800";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide = WIDE_ROUTES.some((route) => pathname?.startsWith(route));

  return <div className={`${BASE} ${wide ? "max-w-7xl" : "max-w-md"}`}>{children}</div>;
}
