"use client";

import type { ReactNode } from "react";

/**
 * Shared style tokens + small presentational primitives used across every
 * screen so light/dark theming and spacing stay consistent without pulling
 * in a component library.
 */

export const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-orange-500";

export const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300";

export const primaryButtonClass =
  "rounded-xl bg-orange-600 px-4 py-3 text-center font-medium text-white transition active:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-xl border border-orange-600 px-4 py-3 text-center font-medium text-orange-600 transition active:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-500 dark:text-orange-400 dark:active:bg-orange-950/40";

export const ghostButtonClass =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 transition active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:active:bg-neutral-800";

export const cardRowClass =
  "rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40";

export const linkClass = "text-orange-600 underline decoration-orange-200 underline-offset-2 dark:text-orange-400 dark:decoration-orange-900";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2Z" />
    </svg>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16">
      <Spinner className="h-6 w-6 text-orange-600 dark:text-orange-400" />
      <p className="text-sm text-neutral-400 dark:text-neutral-500">{label}</p>
    </main>
  );
}

export function EmptyState({
  icon = "🗒️",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 px-6 py-10 text-center dark:border-neutral-700">
      <div className="text-2xl" aria-hidden="true">
        {icon}
      </div>
      <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{title}</p>
      {hint && <p className="text-xs text-neutral-400 dark:text-neutral-500">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400" role="alert">
      {children}
    </p>
  );
}

const TONE_CLASS = {
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
  neutral: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
} as const;

export function InfoBanner({ children, tone = "amber" }: { children: ReactNode; tone?: keyof typeof TONE_CLASS }) {
  return <p className={`rounded-lg px-3 py-2 text-sm ${TONE_CLASS[tone]}`}>{children}</p>;
}

const BADGE_TONE_CLASS = {
  neutral: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof BADGE_TONE_CLASS }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_TONE_CLASS[tone]}`}>{children}</span>;
}
