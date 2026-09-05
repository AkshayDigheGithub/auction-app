# Structured data plan

There is no schema.org markup anywhere in the repo today (audit finding B5). This
document says what we can honestly publish now, what is blocked, and what we must
not publish at all.

Reassessed 2026-09-05 after `PILOT_CITY` was set to `"Pune"`. The city decision
adds exactly one new fact to this document — `areaServed` on `Organization`,
below. It does not add `LocalBusiness`, per-shop markup, or anything else that
would assert more presence in Pune than 3 verified shops and 4 shops within a
25 km ring actually support.

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
[`apps/site/src/lib/site.ts:52-53`](../../apps/site/src/lib/site.ts) are
placeholders (`+91 00000 00000`, `hello@example.com`) that currently render live
on every page. Publishing those as structured contact data would put a fake
number into Google's knowledge graph. Ship `Organization` without `contactPoint`
now; add it the day a real staffed line exists.

`areaServed` is newly available and should ship alongside the rest of
`Organization`. `PILOT_CITY` is `"Pune"` as of 2026-09-05
([`apps/site/src/lib/site.ts:32`](../../apps/site/src/lib/site.ts)), and the
Coverage section already makes the claim "Live in Pune" in visible copy
([`apps/site/src/app/page.tsx:312`](../../apps/site/src/app/page.tsx)). The rule
at the top of this document — markup must describe what is actually on the page
— cuts in favour of adding it now, because the page already asserts exactly
this and nothing more:

```tsx
{
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "mivikto.store",
  url: "https://mivikto.store",
  areaServed: {
    "@type": "City",
    name: "Pune",
  },
}
```

Keep it to the city, not a locality within it. `areaServed: "Pune"` matches the
one geo-claim the site makes. Anything narrower — a neighbourhood, a radius, a
set of postal codes — would assert a coverage guarantee that four shops in a
25 km ring cannot back, and it is the kind of specific-sounding claim that reads
worse when it turns out to be thin than a vaguer one would.

## Blocked, with the specific blocker

### LocalBusiness — still do not publish

The pilot city no longer blocks this the way it did; a different problem does.
`LocalBusiness` describes a business with a physical premises — an address, a
`geo` coordinate pair, a place a customer could stand in front of. mivikto has
none of that to offer for itself: there is no office address anywhere in the
public copy, and `CONTACT_PHONE`/`CONTACT_EMAIL` are still placeholders (B2,
[`apps/site/src/lib/site.ts:52-53`](../../apps/site/src/lib/site.ts)). Marking
the platform up as a `LocalBusiness` would be inventing a premises for a
service that deliberately has none — mivikto is a marketplace, not a shop
front, and `Organization` plus `areaServed` says that correctly where
`LocalBusiness` would not.

Nor does the pilot-city decision create an opening for **per-shop**
`LocalBusiness` markup. Do not build that, ever, regardless of density: shop
identity is hidden from the customer until a deal locks — the product's
revenue guardrail (spec §2, §5) — and structured data naming a shop before that
point would leak exactly what the matching flow is designed to withhold. This
is a design constraint, not a data-availability one, so it does not get
revisited when shop count grows.

The honest inventory today is also thin on the count that would matter most if
we ever did reconsider a *directory*-style listing: 11 shops total, only 3
verified, and only 4 within a generous 25 km ring of Pune's centre. That is a
separate reason this stays closed for now, but it is not the load-bearing one
— the design guardrail is.

Related: a Google Business Profile for mivikto itself is likely to matter more
than any markup here, for the reasons in [strategy.md](strategy.md), and it
carries the same constraint — do not create one until there is a real,
staffed address and phone number to put on it (B2).

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
