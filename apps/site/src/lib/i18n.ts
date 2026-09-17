/**
 * Two languages, one of them added because of who actually reads this.
 *
 * The blog is aimed at shop owners in Pune. A good number of them will read a
 * 1,500-word explainer about payment charges more carefully in Hindi than in
 * English, and the alternative — machine translation in the browser — mangles
 * exactly the parts that matter here, which are the numbers and the thresholds.
 *
 * Only the blog is translated. Translating the whole site would mean keeping
 * two copies of every pricing claim in step, and a stale Hindi page making a
 * promise the English one has already withdrawn is worse than no Hindi page.
 */
export type Locale = "en" | "hi";

export const LOCALES: Locale[] = ["en", "hi"];

export const LOCALE_META: Record<
  Locale,
  {
    /** The `lang` attribute and the hreflang key. Regioned: this is India-only. */
    htmlLang: string;
    /** How the language names itself — never "Hindi" to a Hindi reader. */
    endonym: string;
    /** For `openGraph.locale`. */
    ogLocale: string;
  }
> = {
  en: { htmlLang: "en-IN", endonym: "English", ogLocale: "en_IN" },
  hi: { htmlLang: "hi-IN", endonym: "हिन्दी", ogLocale: "hi_IN" },
};

/**
 * English sits at the bare path and Hindi under /hi/.
 *
 * A path prefix rather than a query string or a cookie because it is the one
 * arrangement a crawler can see: each language gets a distinct, linkable URL
 * that can be indexed on its own and annotated with hreflang. A ?lang= switch
 * would leave both versions sharing one URL, and only one of them would ever
 * get indexed.
 */
export function blogIndexPath(locale: Locale): string {
  return locale === "en" ? "/blog" : `/${locale}/blog`;
}

export function blogPostPath(locale: Locale, slug: string): string {
  return `${blogIndexPath(locale)}/${slug}`;
}

/** The other language, for the switcher. Two locales, so this is unambiguous. */
export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "hi" : "en";
}

/**
 * Chrome around the content: everything on the page that is not the post
 * itself. Kept here rather than inline so the Hindi page cannot end up with an
 * English "Published on" above a Hindi headline.
 */
export const UI: Record<Locale, Record<string, string>> = {
  en: {
    blogEyebrow: "Guides for shop owners",
    blogTitle: "Guides",
    blogIntro:
      "Plain explanations of the things that change what a shop actually earns — payment charges, rules, and the rest of it. No jargon, no hype.",
    readInOther: "इसे हिन्दी में पढ़ें",
    published: "Published",
    updated: "Updated",
    minRead: "min read",
    contents: "In this article",
    backToBlog: "All guides",
    ctaTitle: "Let shops near you compete for the order",
    ctaBody:
      "Post what you want to buy. Shops close to you send their best price. You pick one and collect it in person.",
    ctaCustomer: "Post a request",
    ctaShop: "Sign up as a shop",
    sourcesTitle: "Sources and the small print",
    faqHeading: "Quick answers",
    noPosts: "Nothing published yet. Check back shortly.",
  },
  hi: {
    blogEyebrow: "दुकानदारों के लिए गाइड",
    blogTitle: "गाइड",
    blogIntro:
      "जो चीज़ें आपकी असली कमाई पर असर डालती हैं — पेमेंट चार्ज, नियम, और बाक़ी सब — उन्हें सीधी भाषा में समझाया गया है। न भारी-भरकम शब्द, न बढ़ा-चढ़ाकर बातें।",
    readInOther: "Read this in English",
    published: "प्रकाशित",
    updated: "अपडेट",
    minRead: "मिनट का पाठ",
    contents: "इस लेख में",
    backToBlog: "सभी गाइड",
    ctaTitle: "अपने आस-पास की दुकानों को आपके ऑर्डर के लिए मुक़ाबला करने दें",
    ctaBody:
      "आपको जो ख़रीदना है वह पोस्ट कीजिए। आस-पास की दुकानें अपना सबसे अच्छा दाम भेजती हैं। आप एक चुनिए और ख़ुद जाकर सामान ले आइए।",
    ctaCustomer: "रिक्वेस्ट पोस्ट करें",
    ctaShop: "दुकान रजिस्टर करें",
    sourcesTitle: "स्रोत और ज़रूरी बात",
    faqHeading: "छोटे-छोटे जवाब",
    noPosts: "अभी कुछ प्रकाशित नहीं हुआ है। थोड़ी देर बाद देखिए।",
  },
};

/**
 * Dates as a reader in India would write them — "17 September 2026",
 * "17 सितम्बर 2026" — never the American month-first order, and never a bare
 * ISO string, which reads as a machine timestamp rather than a freshness cue.
 */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}
