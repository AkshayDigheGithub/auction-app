"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_URL, NAV_LINKS } from "@/lib/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-ink-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo />
          <span className="font-display text-lg font-bold text-ink-900">mivikto.store</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-600 transition hover:text-ink-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a href={APP_URL} className="text-sm font-medium text-ink-600 transition hover:text-ink-900">
            Log in
          </a>
          <a
            href={APP_URL}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Open the app
          </a>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="-mr-1 rounded-lg p-2 text-ink-600 transition hover:bg-ink-100 md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-200 bg-ink-50 px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-base font-medium text-ink-800 transition hover:bg-ink-100"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <a
            href={APP_URL}
            className="mt-3 block rounded-full bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Open the app
          </a>
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        {/* A location pin with a downward tick — "a price, near you". */}
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" strokeLinejoin="round" />
        <path d="m9 10 2.2 2.4L15 8.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
