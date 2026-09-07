"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CONTACT_PHONE } from "@/lib/site";

/**
 * Error boundary for the marketing site.
 *
 * The site is almost entirely static, so this should effectively never fire —
 * but the one visitor who does hit it is a first-time visitor on the apex
 * domain, and a raw "Application error" is the worst possible first impression
 * of a company asking shop owners to trust it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled site error", error);
  }, [error]);

  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-brand-600">
          Something broke
        </p>
        <h1 className="font-display mt-4 text-3xl font-bold leading-tight text-ink-900 sm:text-4xl">
          This page did not load
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
          That is our fault, not yours. Try again — and if it keeps happening, call us and we will sort it out.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 sm:w-auto"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full rounded-full border border-ink-200 bg-white px-7 py-3.5 text-base font-semibold text-ink-800 transition hover:border-ink-400 sm:w-auto"
          >
            Back to the homepage
          </Link>
        </div>

        <p className="mt-8 text-sm text-ink-500">
          Or call{" "}
          <a className="font-medium text-ink-800 hover:text-brand-700" href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>
            {CONTACT_PHONE}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
