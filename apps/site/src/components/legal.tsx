import type { ReactNode } from "react";

/**
 * Shared furniture for /privacy and /terms.
 *
 * These pages are a conversion asset, not just a compliance checkbox — the
 * commonest shop-owner objection is "this is another lead-gen scheme that will
 * spam my number", and a plainly-worded privacy page answers it. So they are
 * typeset to be read: a narrow measure, real heading hierarchy, and body text
 * at the same size as the rest of the site rather than the shrunken grey block
 * legal pages usually get.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** Human-readable date. Shown so a reader can tell how current this is. */
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <header>
          <h1 className="font-display text-3xl font-bold leading-tight text-ink-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-ink-400">Last updated {updated}</p>
          <div className="mt-6 text-lg leading-relaxed text-ink-600">{intro}</div>
        </header>

        <div className="mt-12 flex flex-col gap-10">{children}</div>
      </div>
    </article>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-ink-900 sm:text-2xl">{heading}</h2>
      <div className="mt-4 flex flex-col gap-4 leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * For the sentences that do the actual reassurance work — the ones a shop owner
 * came to this page to find. Pulled out of the prose so they survive a skim.
 */
export function LegalCallout({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 leading-relaxed text-ink-800">
      {children}
    </p>
  );
}
