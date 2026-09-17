import type { Locale } from "./i18n";

/**
 * The blog's content model.
 *
 * Posts are typed data rather than MDX for one reason: every post has to exist
 * in English and Hindi, and the two have to stay structurally identical. With
 * MDX there would be two documents free to drift — a table that gains a row in
 * one language, a section that quietly disappears from the other. Here a
 * translation is the same tree with different strings, so a missing section is
 * a type error rather than something a reader in one language notices first.
 *
 * It also means both languages share one renderer, so the Hindi page cannot
 * end up looking like a worse version of the English one.
 */

/** A cell, paragraph or list item. Supports `**bold**` and `[text](url)`. */
export type RichText = string;

/**
 * A document this post takes its facts from.
 *
 * Separate from the prose because a citation has to survive being skimmed,
 * copied into a WhatsApp message, and checked by someone who does not believe
 * us. A post about what a shop is going to be charged is worth nothing if the
 * reader cannot get to the government document in one tap and see for
 * themselves; "according to the FAQ" buried in a paragraph is not that.
 */
export interface Source {
  /** The document's own title, not a description of it. */
  label: string;
  url: string;
  /** Who published it and when — the part that makes it checkable. */
  note: string;
}

export type Block =
  | { kind: "p"; text: RichText }
  | { kind: "list"; items: RichText[]; ordered?: boolean }
  | {
      kind: "table";
      head: RichText[];
      rows: RichText[][];
      /** Per-column alignment; defaults to left. Money columns want "right". */
      align?: ("left" | "right")[];
      /** Rendered under the table, smaller — for "source:" style notes. */
      note?: RichText;
    }
  | {
      kind: "callout";
      /** brand = the thing to remember, warn = the thing that gets you in trouble. */
      tone: "brand" | "warn";
      title?: RichText;
      text: RichText;
    }
  | { kind: "stats"; items: { value: string; label: RichText }[] }
  | { kind: "faq"; items: { q: RichText; a: RichText }[] };

export interface Section {
  /**
   * Anchor id, and the key the table of contents is built from.
   *
   * Deliberately the same English slug in every translation: it keeps
   * /blog/x#who-pays and /hi/blog/x#who-pays pointing at the same section, so a
   * link shared in one language still lands correctly when opened in the other.
   * Devanagari fragments would also be percent-encoded into noise when pasted
   * into WhatsApp, which is where this audience shares links.
   */
  id: string;
  heading: string;
  blocks: Block[];
}

export interface Translation {
  /** <title> and <h1>. Keep under ~60 characters so search results do not clip it. */
  title: string;
  /** Meta description and the excerpt on the index. ~155 characters. */
  description: string;
  /** The standfirst under the h1 — the reason to keep reading. */
  standfirst: string;
  /** Ranked terms this page is actually trying to answer, for `keywords`. */
  keywords: string[];
  /** Blocks before the first section heading. */
  intro: Block[];
  sections: Section[];
  /** The documents every figure on this page comes from. */
  sources: Source[];
  /** The "this is not tax advice" line, under the sources.  */
  disclaimer: RichText;
}

export interface Post {
  slug: string;
  /** ISO dates. Both are real edit dates, not deploy times. */
  published: string;
  updated: string;
  translations: Record<Locale, Translation>;
}

import { upiMdr2026En } from "@/content/blog/upi-mdr-charges-2026.en";
import { upiMdr2026Hi } from "@/content/blog/upi-mdr-charges-2026.hi";

/**
 * Newest first — the index renders this order as-is.
 */
export const POSTS: Post[] = [
  {
    slug: "upi-mdr-charges-2026",
    published: "2026-09-17",
    updated: "2026-09-17",
    translations: { en: upiMdr2026En, hi: upiMdr2026Hi },
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Every string a reader sees, for word counting. Order is irrelevant here. */
function textOf(t: Translation): string {
  const fromBlock = (b: Block): string => {
    switch (b.kind) {
      case "p":
        return b.text;
      case "list":
        return b.items.join(" ");
      case "table":
        return [...b.head, ...b.rows.flat(), b.note ?? ""].join(" ");
      case "callout":
        return `${b.title ?? ""} ${b.text}`;
      case "stats":
        return b.items.map((i) => `${i.value} ${i.label}`).join(" ");
      case "faq":
        return b.items.map((i) => `${i.q} ${i.a}`).join(" ");
    }
  };
  return [
    t.standfirst,
    ...t.intro.map(fromBlock),
    ...t.sections.flatMap((s) => [s.heading, ...s.blocks.map(fromBlock)]),
  ].join(" ");
}

/**
 * Minutes to read, rounded up.
 *
 * Devanagari runs to fewer words for the same content and is read a little
 * slower per word, so the divisors differ; one shared 200wpm number would
 * under-report the Hindi page by roughly a third.
 */
export function readingMinutes(t: Translation, locale: Locale): number {
  const words = textOf(t).trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / (locale === "hi" ? 155 : 210)));
}

/** Every question on the page, for the FAQPage structured data. */
export function faqItems(t: Translation): { q: string; a: string }[] {
  return t.sections
    .flatMap((s) => s.blocks)
    .flatMap((b) => (b.kind === "faq" ? b.items : []));
}
