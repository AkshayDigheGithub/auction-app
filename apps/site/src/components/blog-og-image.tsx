import { ImageResponse } from "next/og";
import { getPost, POSTS } from "@/lib/blog";
import { formatDate, UI, type Locale } from "@/lib/i18n";
import { FONT_FAMILY, OG_SIZE, ogFonts, OgCard } from "@/lib/og";

/**
 * The link-preview cards, shared by both languages' image routes.
 *
 * One bundled family covers Latin and Devanagari, so the Hindi card is the
 * English card in Hindi rather than a degraded version of it — and neither
 * depends on a network call at build time. A missing font file is left to
 * throw: that is a repo problem worth failing a build over, unlike a CDN
 * having a bad minute, which is why it is no longer a CDN.
 */
export function ogImageParams(): { slug: string }[] {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function blogOgImage(slug: string, locale: Locale) {
  const post = getPost(slug);
  if (!post) return new Response("Not found", { status: 404 });

  const t = post.translations[locale];

  return new ImageResponse(
    (
      <OgCard
        eyebrow={UI[locale].blogEyebrow}
        title={t.title}
        highlight={t.ogHighlight}
        footer={formatDate(post.updated, locale)}
        fontFamily={FONT_FAMILY}
        script={locale === "hi" ? "devanagari" : "latin"}
      />
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}

/** The guides index card. No highlight — there is no single number to show. */
export async function blogIndexOgImage(locale: Locale) {
  return new ImageResponse(
    (
      <OgCard
        eyebrow={UI[locale].blogEyebrow}
        title={UI[locale].blogTitle}
        footer="mivikto.store"
        fontFamily={FONT_FAMILY}
        script={locale === "hi" ? "devanagari" : "latin"}
      />
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}
