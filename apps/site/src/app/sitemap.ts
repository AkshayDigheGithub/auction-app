import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";
import { blogIndexPath, blogPostPath, LOCALE_META, LOCALES } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

/**
 * The apex sitemap.
 *
 * The static pages still carry no `lastModified`, `changeFrequency` or
 * `priority`. The only timestamp available at build time for those is the
 * deploy time, which is not when the content changed: stamping every page as
 * freshly modified on each unrelated deploy is a claim a crawler can check and
 * find false, and an unreliable lastmod is worth less than none.
 *
 * Blog posts are the exception the original note anticipated — they carry a
 * real edit date in the content file, so they get a real lastModified. If a
 * post is edited, bump `updated` in lib/blog.ts and this follows.
 *
 * Each post is listed once per language, with the other language declared as an
 * alternate, matching the hreflang in the page metadata. The two have to agree;
 * a sitemap that contradicts the page's own annotations is worse than one that
 * stays quiet.
 *
 * Keep this in step with the routes under app/ — a sitemap listing a 404, or
 * omitting a live page, is the sort of thing nobody notices for months.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const postAlternates = (slug: string) =>
    Object.fromEntries(
      LOCALES.map((l) => [LOCALE_META[l].htmlLang, `${SITE_URL}${blogPostPath(l, slug)}`]),
    );

  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },

    ...LOCALES.map((locale) => ({
      url: `${SITE_URL}${blogIndexPath(locale)}`,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [LOCALE_META[l].htmlLang, `${SITE_URL}${blogIndexPath(l)}`]),
        ),
      },
    })),

    ...POSTS.flatMap((post) =>
      LOCALES.map((locale) => ({
        url: `${SITE_URL}${blogPostPath(locale, post.slug)}`,
        lastModified: new Date(`${post.updated}T00:00:00Z`),
        alternates: { languages: postAlternates(post.slug) },
      })),
    ),
  ];
}
