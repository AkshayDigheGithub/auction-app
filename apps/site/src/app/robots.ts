import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The marketing site is the one surface that *should* be indexed, so this
 * allows everything and points at the sitemap.
 *
 * Note this is the opposite of apps/web's robots.ts, which disallows the whole
 * app. That asymmetry is the intent: the apex is public content, the app
 * subdomain is a signed-in tool.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
