import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The apex sitemap. Three static URLs — there is nothing to submit to Search
 * Console without it.
 *
 * Deliberately no `lastModified`, `changeFrequency` or `priority`. The only
 * timestamp available at build time is the deploy time, which is not when the
 * content changed: stamping every page as freshly modified on each unrelated
 * deploy is a claim a crawler can check and find false, and an unreliable
 * lastmod is worth less than none, because it teaches the crawler to distrust
 * the signal. Add real values here if and when pages carry real edit dates.
 *
 * Keep this in step with the routes under app/ — a sitemap listing a 404, or
 * omitting a live page, is the sort of thing nobody notices for months.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
  ];
}
