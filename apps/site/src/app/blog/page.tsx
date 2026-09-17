import type { Metadata } from "next";
import { BlogIndex, PostCard } from "@/components/blog";
import { POSTS } from "@/lib/blog";
import { blogIndexPath, LOCALE_META, LOCALES, UI } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

const INDEX_DESCRIPTION =
  "Plain-language guides for shop owners in Pune — payment charges, rules and the things that change what a shop actually earns.";

export const metadata: Metadata = {
  title: "Guides for shop owners",
  description: INDEX_DESCRIPTION,
  alternates: {
    canonical: "/blog",
    languages: Object.fromEntries([
      ...LOCALES.map((l) => [LOCALE_META[l].htmlLang, `${SITE_URL}${blogIndexPath(l)}`]),
      ["x-default", `${SITE_URL}/blog`],
    ]),
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/blog`,
    title: "Guides for shop owners · mivikto.store",
    description: INDEX_DESCRIPTION,
    locale: "en_IN",
    alternateLocale: "hi_IN",
  },
};

export default function BlogIndexPage() {
  return (
    <BlogIndex locale="en">
      {POSTS.length === 0 ? (
        <p className="text-ink-500">{UI.en.noPosts}</p>
      ) : (
        POSTS.map((post) => <PostCard key={post.slug} post={post} locale="en" />)
      )}
    </BlogIndex>
  );
}
