import Link from "next/link";
import { APP_URL, CONTACT_EMAIL, CONTACT_PHONE, NAV_LINKS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200 bg-white px-5 py-12 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-lg font-bold text-ink-900">Nearby Bids</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Post what you want to buy. Shops near you send their best price.
          </p>
          <p className="mt-4 text-sm text-ink-500">
            {/* A voice on the phone does more for this audience than a contact
                form does. Whoever staffs this line has to actually answer it. */}
            Talk to a person:{" "}
            <a className="font-medium text-ink-800 hover:text-brand-700" href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>
              {CONTACT_PHONE}
            </a>
            <br />
            <a className="font-medium text-ink-800 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
          <nav className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Product</p>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-ink-600 hover:text-ink-900">
                {l.label}
              </Link>
            ))}
            <a href={APP_URL} className="text-sm text-ink-600 hover:text-ink-900">
              Open the app
            </a>
          </nav>

          <nav className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Legal</p>
            <Link href="/privacy" className="text-sm text-ink-600 hover:text-ink-900">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-ink-600 hover:text-ink-900">
              Terms
            </Link>
          </nav>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-ink-200 pt-6">
        <p className="text-xs leading-relaxed text-ink-400">
          © {new Date().getFullYear()} Nearby Bids. Currently running as a pilot — features and pricing may change,
          and we will tell shop owners before anything starts costing money.
        </p>
      </div>
    </footer>
  );
}
