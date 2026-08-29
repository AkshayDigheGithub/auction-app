import Link from "next/link";
import type { Metadata } from "next";
import { CONTACT_PHONE, CUSTOMER_LOGIN_URL, NAV_LINKS, SHOP_LOGIN_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  // A 404 is not a page we want indexed or surfaced in search results.
  robots: { index: false, follow: true },
};

/**
 * Marketing-site 404.
 *
 * The footer links to /privacy and /terms, and the app links back here from a
 * handful of places, so a mistyped or stale URL is a realistic way for a first
 * visitor to land. A bare Next.js 404 on the apex domain reads as "this company
 * is broken" to someone who has never seen the product — so this recovers the
 * visit instead: it names the two things a visitor is most likely to be after,
 * and offers a phone number, which this audience trusts more than a link.
 */
export default function NotFound() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(48rem_24rem_at_50%_-6rem,var(--color-brand-100),transparent_70%)]"
      />

      <div className="mx-auto max-w-2xl text-center">
        <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-brand-600">
          404
        </p>
        <h1 className="font-display mt-4 text-3xl font-bold leading-tight text-ink-900 sm:text-5xl">
          That page is not here
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
          The link may be old, or we may have moved something. Nothing is wrong with your account — this is just a
          missing page.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="w-full rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 sm:w-auto"
          >
            Back to the homepage
          </Link>
          <a
            href={CUSTOMER_LOGIN_URL}
            className="w-full rounded-full border border-ink-200 bg-white px-7 py-3.5 text-base font-semibold text-ink-800 transition hover:border-ink-400 sm:w-auto"
          >
            Open the app
          </a>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-2xl rounded-2xl border border-ink-200 bg-white p-7 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
          Looking for one of these?
        </p>
        <nav className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={`/${l.href}`}
              className="text-base text-ink-600 transition hover:text-ink-900"
            >
              {l.label}
            </Link>
          ))}
          <a href={SHOP_LOGIN_URL} className="text-base text-ink-600 transition hover:text-ink-900">
            List your shop
          </a>
          <Link href="/privacy" className="text-base text-ink-600 transition hover:text-ink-900">
            Privacy
          </Link>
          <Link href="/terms" className="text-base text-ink-600 transition hover:text-ink-900">
            Terms
          </Link>
        </nav>

        <p className="mt-6 border-t border-ink-200 pt-5 text-sm leading-relaxed text-ink-500">
          Still stuck? Call{" "}
          <a
            className="font-medium text-ink-800 hover:text-brand-700"
            href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}
          >
            {CONTACT_PHONE}
          </a>{" "}
          and a person will help.
        </p>
      </div>
    </section>
  );
}
