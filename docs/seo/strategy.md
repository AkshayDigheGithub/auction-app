# SEO strategy

What organic search can and cannot do for mivikto.store at pilot stage.

## The honest summary

SEO is a **secondary channel** for this product right now. It should be funded
as a foundation-laying exercise, not as an acquisition programme.

Three structural reasons, all of which come from the product design rather than
from anything about our execution:

1. **Radius-gated conversion.** A deal only closes when a shop inside the
   matching radius bids (spec §2, 5 km default) and the customer collects in
   person. Organic traffic from outside that radius cannot convert. Unlike a
   national e-commerce site, we cannot bank early traffic and monetise it later.
2. **Commission-only revenue.** Revenue accrues solely on confirmed deals
   (spec §5). There is no ad inventory, no subscription, no value in an
   unconverted visitor.
3. **No budget line.** The running-cost table (spec §8, ~₹2,500–12,000/month)
   contains no marketing or content-production line at all. Any content
   programme is an unbudgeted cost, which is a decision for the business owner,
   not an implementation detail.

What SEO *should* do at this stage is make sure that when the pilot city is
chosen and demand does exist, the site is technically ready to capture it, and
that we have not accumulated debt that is expensive to unwind.

Primary channels, by contrast, are shop-owner field onboarding (spec §10 names
the outreach model as an open question, which implies push rather than pull),
word of mouth seeded at the in-person QR handover (spec §2 step 8–10 creates a
natural referral moment at the point of satisfaction), and tightly geo-fenced
paid within the same radius the matching logic uses.

## The two audiences

The site already serves both, via the audience toggle in the FAQ and the split
step tracks on the homepage. They have almost nothing in common in search.

### Customer — the demand side

- **Who:** electronics and mobile-phone buyers. MVP is a single category,
  "Mobile & Electronics" (spec §4, §9). The spec's own worked example is
  "iPhone 15, 128GB".
- **Context:** mid-range Android, intermittent connectivity, install-averse.
  This is why the product is a PWA with SSR rather than a native app (spec §6),
  and why auth is phone + OTP rather than email (spec §6). It also means email
  capture is not a viable funnel step for us.
- **Intent:** transactional and price-anchored. They are already shopping.
  They search for the *outcome* — a good local price on a specific model — and
  never for the *mechanism*.
- **Journey:** query → local pack or price-comparison result → a shop or
  marketplace listing. We have to intercept a journey that currently ends
  somewhere else.

### Shop owner — the supply side

- **Who:** small, unorganised retail. The spec is explicit that GST is optional
  "because many small shops aren't GST registered" and that requiring it would
  reduce sign-ups (spec §4). This is not a digitally sophisticated buyer.
- **Intent:** a business problem, not a product category. "How do I get more
  customers", "list my shop online free", "sell phones online" — and comparison
  queries against the lead-gen incumbents the spec itself names as the
  onboarding-model precedent, IndiaMART and JingleBid (spec §4).
- **Caveat:** spec §10 lists shop-owner acquisition (manual outreach vs
  self-serve) as an **open decision**. Building an organic funnel for this
  audience means building for an acquisition model the business has not chosen.
  Keep this side cheap until that decision lands.

## Where the demand actually is

Three tiers, and it matters not to confuse them. We have no keyword-tool data;
these are qualitative and need validating against Keyword Planner or Ahrefs now
that the pilot city (Pune, decided 2026-09-05) is fixed. **No volume figures
appear in this document because we do not have any.**

**Tier A — product and local intent.** "iPhone 15 price in Pune", "mobile shop
near me", "electronics store near me". Real, existing demand. Entirely owned by
others today.

**Tier B — comparison and advice.** "best place to buy a phone in <city>",
"how to get the best price on a phone", "cheapest mobile shop <city>". Smaller,
more informational, and materially less contested.

**Tier C — the mechanism itself.** "reverse auction app", "hyperlocal bidding
app", "shops bid for my order". Near-zero demand, because the category does not
exist in anyone's mental model.

**The strategic error to avoid is targeting Tier C.** It is the language we use
internally and the language the homepage leads with, so it is the natural thing
to optimise for — and almost nobody types it. Rank for the outcome, describe the
mechanism once they arrive.

## Competitive reality

Every tier of Tier A demand is contested by better-resourced incumbents:

- **Google's own local pack and Maps** dominate the fold for "near me" queries.
  This is the biggest structural obstacle, and no amount of page-level SEO
  substitutes for it. It also means a Google Business Profile — for us and,
  arguably, for our shops — matters more than our own rankings for these terms.
- **Marketplaces** (Amazon, Flipkart) own model-name and price queries on
  domain authority and ad spend.
- **Price-comparison portals** (91mobiles, Smartprix and similar) own
  "price in <city>".
- **Listings and lead-gen** (JustDial, Sulekha, IndiaMART, OLX) own the
  shop-owner side. The spec cites IndiaMART as the model to imitate, which is a
  tacit admission that they already own that search space.

The genuine gap is Tier B plus the price-competition framing — "make shops
compete for your order" — which nobody occupies because nobody searches for it
yet. That is a content and education play with a long payback, and it only
becomes credible once there is enough local supply to make the promise true.

## Language

Start English, with Hinglish variants worked naturally into the same pages. Two
reasons: model names and brands are typed in Roman script across India
regardless of the language spoken, so Tier A head terms do not require
regional-language pages; and a genuine Hindi or regional-language build is a
content-production cost that spec §8 does not budget for.

The pilot city is fixed now (Pune); this is still gated on unit economics, which
are not. Revisit once those are validated. There is no i18n framework in the
stack today (spec §6), so this would be a real build, not a copy exercise.

## What we will not do yet

- **Programmatic location or category pages.** The pilot city is fixed now
  (Pune), but shop density is not there yet — 4 shops within a generous 25 km
  ring as of 2026-09-05 — and MVP is a single category so there is no category
  axis to build on regardless. See [backlog.md](backlog.md) for the density
  gate that should gate these.
- **A blog or content hub.** Not needed to validate the core loop.
- **Link building or directory campaigns.** These presume a live product to
  send traffic to.
- **Any public commission figure.** Spec §10 has it open; the site currently
  and correctly says "free during the pilot" and declines to name a rate.
  Metadata and structured data must not get ahead of that.
