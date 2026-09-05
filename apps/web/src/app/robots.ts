import type { MetadataRoute } from "next";

/**
 * The app subdomain should never appear in search results. It is a signed-in
 * tool, not content — twelve client-rendered routes sharing one title, most of
 * them behind auth.
 *
 * The obvious implementation is `disallow: "/"`, and it is the wrong one here.
 * Disallow stops a crawler *fetching* the page; it does not stop the URL being
 * listed. A URL that is disallowed but linked from elsewhere still shows up as
 * a bare, description-less result — and the marketing site links to this app
 * prominently from its header, footer and every call to action, so those links
 * are exactly the discovery path that produces that listing.
 *
 * Worse, the two mechanisms conflict: `noindex` lives in the page's own
 * response, so a crawler blocked by Disallow never fetches the page and never
 * sees it. Disallow does not merely fail to help, it prevents the fix.
 *
 * So crawling is allowed *on purpose*, and exclusion is done with `noindex` in
 * the root layout's metadata (apps/web/src/app/layout.tsx), which is the only
 * one of the two that actually removes a page from an index. If you are about
 * to change this to Disallow, that is the trade you are making.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
