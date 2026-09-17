import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, Post, Translation } from "@/lib/blog";
import { readingMinutes } from "@/lib/blog";
import {
  blogIndexPath,
  blogPostPath,
  formatDate,
  LOCALE_META,
  otherLocale,
  UI,
  type Locale,
} from "@/lib/i18n";
import { CUSTOMER_LOGIN_URL, SHOP_LOGIN_URL } from "@/lib/site";

/**
 * One renderer for both languages.
 *
 * Nothing in here branches on locale except the strings it is handed, so the
 * Hindi page is the English page — same measure, same tables, same hierarchy.
 * The alternative, a second set of components, is how translated pages end up
 * looking like a photocopy of the real one.
 */

/* ---------------------------------------------------------------- inline --- */

/**
 * The inline markup the content model allows: `**bold**` and `[text](url)`.
 *
 * Deliberately not a Markdown parser. Content is authored by us, in TypeScript,
 * and every additional inline feature is another way for a translation to
 * render differently from its original. These two earn their place: bold
 * because these posts turn on specific numbers and a number has to survive a
 * skim, links because a claim about what someone will be charged should be one
 * tap from the document it came from.
 */
const INLINE_TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE_TOKEN).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-ink-900">
              {part.slice(2, -2)}
            </strong>
          );
        }

        const link = part.match(LINK);
        if (!link) return part;

        const [, label, href] = link;
        // Everything we cite is an external document, and http(s) is the only
        // scheme worth rendering as a link — anything else is an authoring
        // mistake, and showing the label as plain text makes it visible in
        // review rather than shipping a dead or odd link.
        if (!/^https?:\/\//.test(href)) return label;

        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 transition hover:decoration-brand-600"
          >
            {label}
          </a>
        );
      })}
    </>
  );
}

/* ----------------------------------------------------------------- blocks --- */

function Paragraph({ text }: { text: string }) {
  return (
    <p className="text-[1.0625rem] leading-[1.75] text-ink-600">
      <Inline text={text} />
    </p>
  );
}

function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  if (ordered) {
    return (
      <ol className="flex flex-col gap-4">
        {items.map((item, i) => (
          <li key={i} className="flex gap-4">
            <span
              aria-hidden
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700"
            >
              {i + 1}
            </span>
            <span className="text-[1.0625rem] leading-[1.75] text-ink-600">
              <Inline text={item} />
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3.5">
          <span aria-hidden className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          <span className="text-[1.0625rem] leading-[1.75] text-ink-600">
            <Inline text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Table({
  head,
  rows,
  align,
  note,
}: {
  head: string[];
  rows: string[][];
  align?: ("left" | "right")[];
  note?: string;
}) {
  // A table with no headings is a label/value sheet, not a data table — it gets
  // the first column styled as a heading column instead of a header row.
  const isKeyValue = head.every((h) => h === "");
  const cellAlign = (i: number) => (align?.[i] === "right" ? "text-right" : "text-left");

  return (
    <figure className="flex flex-col gap-2.5">
      {/* Tables are the densest thing on the page and the likeliest to overflow
          a phone. Scrolling one horizontally is better than shrinking the type
          until the numbers stop being readable, which is the whole point. */}
      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full border-collapse text-[0.9375rem]">
          {!isKeyValue && (
            <thead>
              <tr className="border-b border-ink-200 bg-ink-100/60">
                {head.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={`px-4 py-3 font-semibold text-ink-800 ${cellAlign(i)}`}
                  >
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-ink-200/70 last:border-0">
                {row.map((cell, c) =>
                  isKeyValue && c === 0 ? (
                    <th
                      key={c}
                      scope="row"
                      className="w-[42%] px-4 py-3 text-left align-top font-medium text-ink-500"
                    >
                      <Inline text={cell} />
                    </th>
                  ) : (
                    <td
                      key={c}
                      className={`px-4 py-3 align-top text-ink-600 ${cellAlign(c)}`}
                    >
                      <Inline text={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && (
        <figcaption className="px-1 text-[0.8125rem] leading-relaxed text-ink-400">
          <Inline text={note} />
        </figcaption>
      )}
    </figure>
  );
}

function Callout({ tone, title, text }: { tone: "brand" | "warn"; title?: string; text: string }) {
  // Warn is amber rather than red: none of these are errors, they are the
  // sentences that cost money if skimmed past. Red would read as a site fault.
  const skin =
    tone === "warn"
      ? "border-amber-300/80 bg-amber-50"
      : "border-brand-200 bg-brand-50/70";
  const iconSkin = tone === "warn" ? "text-amber-600" : "text-brand-600";

  return (
    <aside className={`flex gap-4 rounded-2xl border px-5 py-5 ${skin}`}>
      <span aria-hidden className={`mt-0.5 shrink-0 ${iconSkin}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {tone === "warn" ? (
            <>
              <path d="M12 9v4" strokeLinecap="round" />
              <path d="M12 17h.01" strokeLinecap="round" />
              <path
                d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
            </>
          )}
        </svg>
      </span>
      <div className="flex flex-col gap-1.5">
        {title && (
          <p className="font-display font-bold text-ink-900">
            <Inline text={title} />
          </p>
        )}
        <p className="text-[1.0625rem] leading-[1.7] text-ink-800">
          <Inline text={text} />
        </p>
      </div>
    </aside>
  );
}

function Stats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl border border-ink-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
        >
          <dt className="font-display text-2xl font-bold tracking-tight text-brand-700 sm:text-[1.75rem]">
            {item.value}
          </dt>
          <dd className="mt-1 text-[0.8125rem] leading-snug text-ink-500">
            <Inline text={item.label} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Questions as <details> rather than a JS accordion.
 *
 * It is keyboard accessible and findable by the browser's own in-page search
 * without a line of script, which matters more than usual here: these pages get
 * opened from a WhatsApp forward on a mid-range phone over a patchy connection.
 */
function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <details
          key={i}
          className="group rounded-2xl border border-ink-200 bg-white px-5 open:shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-12px_rgba(28,25,23,0.10)]"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 font-medium text-ink-900 marker:hidden [&::-webkit-details-marker]:hidden">
            <span>
              <Inline text={item.q} />
            </span>
            <span aria-hidden className="mt-1 shrink-0 text-ink-400 transition group-open:rotate-180">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
          <p className="pb-5 text-[1.0625rem] leading-[1.7] text-ink-600">
            <Inline text={item.a} />
          </p>
        </details>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "p":
      return <Paragraph text={block.text} />;
    case "list":
      return <List items={block.items} ordered={block.ordered} />;
    case "table":
      return <Table head={block.head} rows={block.rows} align={block.align} note={block.note} />;
    case "callout":
      return <Callout tone={block.tone} title={block.title} text={block.text} />;
    case "stats":
      return <Stats items={block.items} />;
    case "faq":
      return <Faq items={block.items} />;
  }
}

/* ------------------------------------------------------------------ chrome --- */

export function LanguageSwitch({ locale, slug }: { locale: Locale; slug: string }) {
  const other = otherLocale(locale);
  return (
    <Link
      href={blogPostPath(other, slug)}
      hrefLang={LOCALE_META[other].htmlLang}
      lang={LOCALE_META[other].htmlLang}
      className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700"
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
      </svg>
      {UI[locale].readInOther}
    </Link>
  );
}

function Contents({ post, locale }: { post: Post; locale: Locale }) {
  const t = post.translations[locale];
  return (
    <nav aria-label={UI[locale].contents} className="rounded-2xl border border-ink-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
        {UI[locale].contents}
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {t.sections.map((s, i) => (
          <li key={s.id} className="flex gap-3 text-[0.9375rem]">
            <span aria-hidden className="w-4 shrink-0 text-right tabular-nums text-ink-400">
              {i + 1}
            </span>
            <a href={`#${s.id}`} className="text-ink-600 transition hover:text-brand-700">
              {s.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Cta({ locale }: { locale: Locale }) {
  const ui = UI[locale];
  return (
    <aside className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-ink-50 px-6 py-7">
      <p className="font-display text-xl font-bold leading-snug text-ink-900">{ui.ctaTitle}</p>
      <p className="mt-2 text-[1.0625rem] leading-relaxed text-ink-600">{ui.ctaBody}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={CUSTOMER_LOGIN_URL}
          className="rounded-full bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          {ui.ctaCustomer}
        </a>
        <a
          href={SHOP_LOGIN_URL}
          className="rounded-full border border-ink-200 bg-white px-5 py-3 text-center text-sm font-semibold text-ink-800 transition hover:border-brand-200 hover:text-brand-700"
        >
          {ui.ctaShop}
        </a>
      </div>
    </aside>
  );
}

/* ----------------------------------------------------------------- article --- */

function Meta({ post, locale }: { post: Post; locale: Locale }) {
  const ui = UI[locale];
  const t = post.translations[locale];
  const changed = post.updated !== post.published;
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-500">
      <span>
        {changed ? ui.updated : ui.published}{" "}
        <time dateTime={changed ? post.updated : post.published}>
          {formatDate(changed ? post.updated : post.published, locale)}
        </time>
      </span>
      <span aria-hidden className="h-1 w-1 rounded-full bg-ink-400" />
      <span>
        {readingMinutes(t, locale)} {ui.minRead}
      </span>
    </p>
  );
}

export function PostArticle({ post, locale }: { post: Post; locale: Locale }) {
  const t: Translation = post.translations[locale];
  const ui = UI[locale];

  return (
    <article lang={LOCALE_META[locale].htmlLang}>
      {/* Header sits on a tinted band so the standfirst reads as a deck rather
          than as the first paragraph of the body. */}
      <header className="border-b border-ink-200 bg-gradient-to-b from-brand-50/70 to-ink-50 px-5 pb-12 pt-10 sm:px-8 sm:pb-14 sm:pt-14">
        <div className="mx-auto max-w-2xl">
          <Link
            href={blogIndexPath(locale)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600 transition hover:text-brand-700"
          >
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {ui.backToBlog}
          </Link>

          <h1 className="font-display mt-4 text-3xl font-bold leading-[1.15] text-ink-900 sm:text-[2.6rem]">
            {t.title}
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-ink-600 sm:text-xl">{t.standfirst}</p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <Meta post={post} locale={locale} />
            <LanguageSwitch locale={locale} slug={post.slug} />
          </div>
        </div>
      </header>

      <div className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex max-w-2xl flex-col gap-10">
          {t.intro.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}

          <Contents post={post} locale={locale} />

          {t.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-display text-2xl font-bold leading-tight text-ink-900 sm:text-[1.75rem]">
                {section.heading}
              </h2>
              <div className="mt-5 flex flex-col gap-6">
                {section.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </div>
            </section>
          ))}

          <aside className="rounded-2xl border border-ink-200 bg-ink-100/50 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">
              {ui.sourcesTitle}
            </p>

            <ol className="mt-3.5 flex flex-col gap-3">
              {t.sources.map((source, i) => (
                <li key={i} className="flex gap-3 text-[0.9375rem] leading-relaxed">
                  <span aria-hidden className="w-4 shrink-0 text-right tabular-nums text-ink-400">
                    {i + 1}
                  </span>
                  <span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 transition hover:decoration-brand-600"
                    >
                      {source.label}
                    </a>
                    <span className="text-ink-500"> — {source.note}</span>
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-4 border-t border-ink-200 pt-4 text-[0.9375rem] leading-relaxed text-ink-500">
              <Inline text={t.disclaimer} />
            </p>
          </aside>

          <Cta locale={locale} />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-200 pt-8">
            <Link
              href={blogIndexPath(locale)}
              className="text-sm font-medium text-ink-600 transition hover:text-brand-700"
            >
              ← {ui.backToBlog}
            </Link>
            <LanguageSwitch locale={locale} slug={post.slug} />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------- index --- */

export function PostCard({ post, locale }: { post: Post; locale: Locale }) {
  const t = post.translations[locale];
  const ui = UI[locale];

  return (
    <Link
      href={blogPostPath(locale, post.slug)}
      className="group flex flex-col gap-3 rounded-3xl border border-ink-200 bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-12px_rgba(28,25,23,0.10)] transition hover:border-brand-200 sm:p-8"
    >
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-500">
        <time dateTime={post.updated}>{formatDate(post.updated, locale)}</time>
        <span aria-hidden className="h-1 w-1 rounded-full bg-ink-400" />
        <span>
          {readingMinutes(t, locale)} {ui.minRead}
        </span>
      </p>
      <h2 className="font-display text-2xl font-bold leading-tight text-ink-900 transition group-hover:text-brand-700 sm:text-3xl">
        {t.title}
      </h2>
      <p className="text-[1.0625rem] leading-relaxed text-ink-600">{t.description}</p>
      <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
        {locale === "hi" ? "पूरा पढ़िए" : "Read it"}
        <svg
          aria-hidden
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="transition group-hover:translate-x-0.5"
        >
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

export function BlogIndex({ locale, children }: { locale: Locale; children?: ReactNode }) {
  const ui = UI[locale];
  return (
    <div lang={LOCALE_META[locale].htmlLang}>
      <header className="border-b border-ink-200 bg-gradient-to-b from-brand-50/70 to-ink-50 px-5 pb-12 pt-12 sm:px-8 sm:pb-14 sm:pt-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
            {ui.blogEyebrow}
          </p>
          <h1 className="font-display mt-3 text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
            {ui.blogTitle}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-600">{ui.blogIntro}</p>
        </div>
      </header>
      <div className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
