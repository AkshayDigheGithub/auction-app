import { notFound } from "next/navigation";
import { getPost, POSTS } from "@/lib/blog";
import { postJsonLd, postMetadata } from "@/lib/blog-seo";
import type { Locale } from "@/lib/i18n";
import { PostArticle } from "@/components/blog";
import type { Metadata } from "next";

/**
 * The body of a post route, shared by /blog/[slug] and /hi/blog/[slug].
 *
 * The two routes exist separately so each language has its own indexable URL,
 * but they must render the same page or the translation stops being a
 * translation. Keeping the implementation in one place is what guarantees that
 * — a change to the article layout cannot land in one language only.
 */

export function postParams(): { slug: string }[] {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function postPageMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const post = getPost(slug);
  // A 404 should not inherit the site's default title as though it were a real
  // page; returning nothing lets the not-found route own its own metadata.
  if (!post) return {};
  return postMetadata(post, locale);
}

export function PostPage({ slug, locale }: { slug: string; locale: Locale }) {
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
      {/*
        Structured data goes in the markup rather than through a metadata field
        because Next has no first-class JSON-LD slot. Stringified in a script
        tag is the documented approach; the content is our own typed object, so
        there is no untrusted input to escape here.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(postJsonLd(post, locale)) }}
      />
      <PostArticle post={post} locale={locale} />
    </>
  );
}
