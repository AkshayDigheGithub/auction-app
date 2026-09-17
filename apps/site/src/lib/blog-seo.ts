import type { Metadata } from "next";
import { faqItems, type Post } from "./blog";
import { blogPostPath, LOCALE_META, LOCALES, otherLocale, type Locale } from "./i18n";
import { SITE_URL } from "./site";

/**
 * Metadata and structured data for a post, in both languages.
 *
 * The two jobs that actually matter here:
 *
 * 1. Tell a crawler these are translations of one another, not duplicates.
 *    Two pages covering the same subject on one domain compete with each other
 *    unless hreflang says otherwise; the reciprocal `languages` map plus a
 *    self-canonical on each is what stops the Hindi page from being filed as a
 *    thin copy of the English one and dropped.
 *
 * 2. Hand the FAQ over as data. These posts answer the questions people type
 *    into a search box almost verbatim ("upi charge kab se lagega"), so the
 *    FAQPage graph is the difference between ranking and being the answer.
 */

/** Every language's absolute URL for one post, keyed by hreflang. */
function languageAlternates(slug: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of LOCALES) {
    map[LOCALE_META[l].htmlLang] = `${SITE_URL}${blogPostPath(l, slug)}`;
  }
  // English is the fallback for anyone we have not translated for — notably
  // Marathi speakers in the pilot city, who currently get the English page.
  map["x-default"] = `${SITE_URL}${blogPostPath("en", slug)}`;
  return map;
}

export function postMetadata(post: Post, locale: Locale): Metadata {
  const t = post.translations[locale];
  const other = otherLocale(locale);
  const url = `${SITE_URL}${blogPostPath(locale, post.slug)}`;

  return {
    title: t.title,
    description: t.description,
    keywords: t.keywords,
    alternates: {
      canonical: blogPostPath(locale, post.slug),
      languages: languageAlternates(post.slug),
    },
    openGraph: {
      type: "article",
      url,
      title: t.title,
      description: t.description,
      publishedTime: post.published,
      modifiedTime: post.updated,
      locale: LOCALE_META[locale].ogLocale,
      alternateLocale: LOCALE_META[other].ogLocale,
      siteName: "mivikto.store",
    },
    twitter: {
      card: "summary_large_image",
      title: t.title,
      description: t.description,
    },
  };
}

/**
 * One @graph rather than three separate script tags — it lets the article,
 * the breadcrumb and the FAQ reference each other by id instead of repeating
 * the page's identity three times.
 */
export function postJsonLd(post: Post, locale: Locale): object {
  const t = post.translations[locale];
  const path = blogPostPath(locale, post.slug);
  const url = `${SITE_URL}${path}`;
  const lang = LOCALE_META[locale].htmlLang;
  const questions = faqItems(t);

  const publisher = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "mivikto.store",
    url: SITE_URL,
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        isPartOf: { "@id": `${url}#webpage` },
        mainEntityOfPage: { "@id": `${url}#webpage` },
        headline: t.title,
        description: t.description,
        inLanguage: lang,
        datePublished: post.published,
        dateModified: post.updated,
        author: publisher,
        publisher,
        keywords: t.keywords.join(", "),
        articleSection: locale === "hi" ? "दुकानदारों के लिए गाइड" : "Guides for shop owners",
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: t.title,
        inLanguage: lang,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "mivikto.store",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: locale === "hi" ? "गाइड" : "Guides",
            item: `${SITE_URL}${locale === "hi" ? "/hi/blog" : "/blog"}`,
          },
          { "@type": "ListItem", position: 3, name: t.title },
        ],
      },
      // Only emitted when the post actually carries questions — an empty
      // FAQPage is a structured-data error rather than a missing feature.
      ...(questions.length
        ? [
            {
              "@type": "FAQPage",
              "@id": `${url}#faq`,
              inLanguage: lang,
              mainEntity: questions.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ]
        : []),
    ],
  };
}
