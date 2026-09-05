# Structured data plan

There is no schema.org markup anywhere in the repo today (audit finding B5). This
document says what we can honestly publish now, what is blocked, and what we must
not publish at all.

## The rule

**Structured data must describe what is actually on the page.** Markup that
asserts something the page does not show is a manual-action risk, and for a
marketplace that has not launched it is also just untrue. Every item below is
sorted by whether we can currently back it up.

## Ship now

### FAQPage — the cheapest win available

[`apps/site/src/components/faq.tsx`](../../apps/site/src/components/faq.tsx)
already holds 14 question-and-answer pairs as plain string arrays with no markup
to strip. Shape:

```tsx
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [...CUSTOMER_FAQ, ...SHOP_FAQ].map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};
```

Emit it from a **server component** with
`<script type="application/ld+json" dangerouslySetInnerHTML=...>`, not from the
client `Faq` component.

**Sequencing matters here.** Google expects FAQ markup to correspond to content
visible on the page. Right now only the active tab renders, so 8 of the 14 pairs
are not in the HTML at all (finding H1). **Fix H1 first, then ship both lists in
the markup.** If H1 is not fixed, mark up only `CUSTOMER_FAQ` — do not describe
content the page does not serve.

Note that rich results for FAQ markup are heavily restricted these days, so treat
this as correct semantic description rather than as a guaranteed SERP feature.

### WebSite

Trivially true today. Name and URL only.

```tsx
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "mivikto.store",
  url: "https://mivikto.store",
}
```

No `SearchAction` — the site has no search, so a `potentialAction` would be a
fabrication.

### Organization — partially

Name is available. `url` is available. `logo` needs a raster file that **does not
exist** — `apps/site` has no `public/` directory at all (finding H4), and the
wordmark is an inline SVG in the header. Producing that asset is the same task as
producing the OG image, so do them together.

`contactPoint` is **blocked on B2** — the phone and email in
[`apps/site/src/lib/site.ts:49`](../../apps/site/src/lib/site.ts) are
placeholders (`+91 00000 00000`, `hello@example.com`) that currently render live
on every page. Publishing those as structured contact data would put a fake
number into Google's knowledge graph. Ship `Organization` without `contactPoint`
now; add it the day a real staffed line exists.

## Blocked, with the specific blocker

### LocalBusiness — do not publish

`PILOT_CITY` is `null`, so there is no address, no `areaServed`, no geo
coordinates, and the Coverage section renders a placeless fallback. Publishing
`LocalBusiness` today would mean inventing a location for a hyperlocal product,
which is both a policy violation and a lie to the user.

Unblocked by spec §10 item 1 — the pilot city decision. Revisit the same day
that lands, because at that point this becomes one of the higher-value items on
the list.

Related: when the city is chosen, a Google Business Profile is likely to matter
more than this markup, for the reasons in [strategy.md](strategy.md).

### Service / HowTo — possible but low value

The step arrays on
[`apps/site/src/app/page.tsx`](../../apps/site/src/app/page.tsx) (three customer
steps, three shop steps, rendered as an ordered list) map cleanly onto `HowTo`.

Worth doing only after the higher-value items. `HowTo` rich results have been
substantially deprecated in Google's results, so the return is mostly semantic
clarity rather than SERP presence. Low priority, not blocked.

## Never, on current facts

- **`AggregateRating` or `Review`.** There are no reviews and no ratings anywhere
  in the product. This is the single most commonly abused markup type and the
  most reliably penalised.
- **`Offer` with a price or a commission rate.** The pricing section explicitly
  declines to publish a rate, and spec §10 confirms the commission is genuinely
  undecided rather than merely unstated. The customer tier is free and the shop
  tier is free during the pilot; if anything is marked up as an offer it can say
  only that, and it must be re-checked the moment billing goes live. Note also
  that fees are currently computed in shadow mode and nobody is charged —
  see [`BACKLOG-monetization.md`](../../BACKLOG-monetization.md).
- **`Product` markup for anything a customer requests.** We do not sell
  products; shops do. Marking up a request as a product would misrepresent the
  marketplace and would be competing, badly, in a space Amazon and Flipkart own.
- **`Event`, `JobPosting`, or any type with no counterpart in the product.**

## Where it lives

Put the JSON-LD in a small server component under
`apps/site/src/components/`, invoked from the layout for site-wide types
(`WebSite`, `Organization`) and from the relevant page for page-scoped types
(`FAQPage`).

Do not inline it into the client components — `faq.tsx` and `site-header.tsx` are
the only two client components on the marketing site, and both should stay that
way.

Validate with Google's Rich Results Test and the schema.org validator before
merging. There is no CI in this repo (audit, Medium section), so this check is
manual and needs to be in the PR description rather than assumed.
