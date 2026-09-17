import type { Metadata } from "next";
import { BlogIndex, PostCard } from "@/components/blog";
import { POSTS } from "@/lib/blog";
import { blogIndexPath, LOCALE_META, LOCALES, UI } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

const INDEX_DESCRIPTION =
  "दुकानदारों के लिए सीधी भाषा में गाइड — पेमेंट चार्ज, नियम, और वे बातें जो आपकी असली कमाई बदल देती हैं।";

export const metadata: Metadata = {
  title: "दुकानदारों के लिए गाइड",
  description: INDEX_DESCRIPTION,
  alternates: {
    canonical: "/hi/blog",
    languages: Object.fromEntries([
      ...LOCALES.map((l) => [LOCALE_META[l].htmlLang, `${SITE_URL}${blogIndexPath(l)}`]),
      ["x-default", `${SITE_URL}/blog`],
    ]),
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/hi/blog`,
    title: "दुकानदारों के लिए गाइड · mivikto.store",
    description: INDEX_DESCRIPTION,
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

export default function HindiBlogIndexPage() {
  return (
    <BlogIndex locale="hi">
      {POSTS.length === 0 ? (
        <p className="text-ink-500">{UI.hi.noPosts}</p>
      ) : (
        POSTS.map((post) => <PostCard key={post.slug} post={post} locale="hi" />)
      )}
    </BlogIndex>
  );
}
