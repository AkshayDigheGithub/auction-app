# Keyword map

Which query belongs to which page. Read [strategy.md](strategy.md) first — the
tier definitions and the competitive picture are there.

## Standing caveats

- **No search volumes appear in this document.** We have no keyword-tool data.
  Every judgement below is qualitative and needs validating against Google
  Keyword Planner or Ahrefs now that the pilot city is fixed.
- `PILOT_CITY` is `"Pune"` as of 2026-09-05
  ([`apps/site/src/lib/site.ts:32`](../../apps/site/src/lib/site.ts)), so
  `<city>` below has been resolved to Pune. `<area>` stays a placeholder — it
  names a locality within Pune, and no locality has enough shops behind it to
  target honestly yet. Do not substitute a guessed area name. A real query of
  the production database on 2026-09-05 found 11 shops total, 3 verified, and
  only 4 within a generous 25 km ring of Pune's centre, all in the single MVP
  category (`mobile_electronics`); see [technical-audit.md](technical-audit.md)
  finding B3 and the gate in [backlog.md](backlog.md). Resolving the city name
  is not the same thing as having supply to back an area page, and this
  document is careful below to keep those two facts separate.
- Every phrasing below must stay consistent with what the site actually
  promises. The FAQ deliberately refuses to promise bid speed, and the pricing
  section deliberately refuses to name a commission rate. Metadata must not get
  ahead of either.

## The pages we have

Three indexable URLs. That is the whole site.

| URL | Audience | Primary intent to own | Secondary |
|---|---|---|---|
| `/` | Both, split by section | Brand: `mivikto`, `mivikto.store`. Concept: "make local shops compete for your order", "get bids from nearby shops" | "sell your phone stock online", "get customers for my mobile shop" (via the `#for-shops` section) |
| `/privacy` | Both | Brand + trust: "mivikto privacy", "is mivikto safe", "who sees my phone number" | Nothing to chase |
| `/terms` | Both, shop-weighted | Brand + trust: "mivikto terms", "mivikto commission" | Nothing to chase |

The homepage is being asked to serve two audiences and four intents at once. That
is a deliberate pilot-stage call recorded in
[`apps/site/src/lib/site.ts:58`](../../apps/site/src/lib/site.ts) — one city, one
category, thin content on both sides, so two half-empty pages would be worse than
one. It is the right call now, and it is also the ceiling on what the site can
rank for. Splitting is a post-pilot decision driven by scroll and search data.

Note that "one city" no longer means "no city" — it means Pune specifically,
and specifically only Pune. The single-page decision was never actually about
the city being unknown; it was about there being one category and thin content
either way. That reasoning holds unchanged now that the city has a name.

## Intent tiers, mapped

### Tier A — product and local intent

`iphone 15 price in Pune` · `mobile shop near me` · `electronics store <area>`
· `best mobile shop in Pune`

**Owned by:** Google's local pack, Amazon and Flipkart, price-comparison portals.

**Our position:** no page targets these and none should yet — and, importantly,
resolving `<city>` to Pune does not change that. B3 is resolved (the city is
known); what still blocks a page here is supply. These queries need a location
or category page with real shops behind it, and a query of the production
database on 2026-09-05 found only 4 shops within a generous 25 km ring of
Pune's centre, all in one category. See the gating rule below — **blocked on
shop density, not on the city name.**

The honest read is that we will not beat the local pack at "near me" on our own
pages regardless. Now that the city is fixed, a Google Business Profile for
mivikto itself is likely worth more than any page we write for this tier — and
it carries its own blocker, a real staffed phone number (B2), not the city.

### Tier B — comparison and advice

`how to get the best price on a phone in Pune` · `cheapest place to buy a
phone Pune` · `should I buy a phone online or from a shop` · `how to negotiate
phone price`

**Owned by:** loosely held. Price-comparison portals cover the transactional
edge; the advice edge is thin.

**Our position:** this is the realistic wedge, and the city being fixed makes
it genuinely writable now rather than hypothetically writable — "in Pune" is a
real qualifier instead of a placeholder. It is informational, so it converts
worse per visit, but it is winnable and it maps onto content we can write
truthfully today.

**No page exists for this tier, and none should exist yet.** The city decision
removes the placeholder problem but not the budget problem: this would be the
first genuine reason to add a route beyond the current three, and the first
thing that starts to look like a content programme, which spec §8 does not
budget for. Do not start it without that being an explicit business decision —
see [backlog.md](backlog.md) Tier 4.

### Tier C — the mechanism

`reverse auction app india` · `hyperlocal bidding app` · `shops bid for my order`

**Our position:** the homepage already ranks here by default, and this tier has
near-zero demand because the category does not exist in anyone's mental model.

**This is the trap.** It is the language we use internally and the language the
hero leads with, so it is the natural thing to optimise for. Keep the concept
copy — it is what converts once someone arrives — but do not spend effort trying
to grow traffic from it.

### Shop-owner intent

`how to get more customers for my mobile shop` · `list my shop online free` ·
`sell mobile phones online Pune` · `indiamart alternative for small shops`

**Our position:** served today only by the `#for-shops` anchor on the homepage —
and **half of the relevant FAQ copy is not even in the HTML** (finding H1). Fixing
H1 is the cheapest improvement available to this audience.

Note the standing caveat from [strategy.md](strategy.md): spec §10 leaves
shop-owner acquisition (manual outreach vs self-serve) undecided, so keep this
side cheap until that lands.

## Pages we do not have, and when to build them

### Location pages — gated on supply, not on effort, and now measured

A locality page with two shops and no completed deals is thin content by Google's
definition and looks broken to a real visitor. Both failure modes are worse than
having no page.

This is no longer a hypothetical. A read-only query of the production database
on 2026-09-05 found 11 shops total in Pune, 3 verified, and only 4 within a
generous 25 km ring of the city centre — a ring far larger than the 5 km default
matching radius (spec §2) any single locality page would actually promise. 22
requests and 8 deals exist all-time, city-wide. Split across the named
localities a location page would target — Kothrud, Koregaon Park, Hadapsar,
Viman Nagar, Baner, and the rest — that is zero or one shop each. This is
exactly the density the gate below exists to catch, and at this density every
locality in Pune fails it.

**Proposed gate**, to be set with real pilot data rather than guessed now:

- a minimum count of active, bidding shops within the locality's matching radius
  (5 km default, spec §2 — itself an open decision per §10), **and**
- a minimum count of completed deals in a trailing window.

The actual numbers are a business and product call once there is usage to look
at — see the concrete proposal in [backlog.md](backlog.md). What is firm is the
shape: **no page ships for a locality that cannot serve the promise the page
makes**, and none can today.

Note that the category axis does not exist yet — MVP is single-category, "Mobile
& Electronics" (spec §4, §9) — so this is a one-dimensional problem until
multi-category ships, which is explicitly post-MVP.

### A dedicated `/for-shops` route

Justifiable once the shop-owner FAQ is actually crawlable (H1) and the
acquisition model is decided. Not before — it would be a second half-empty page,
which is exactly what the current single-page decision was made to avoid.

### Advice content for Tier B

See above. Real opportunity, real unbudgeted cost, needs a decision.

## Metadata targets for the pages that exist

Concrete replacements, safe to ship today. All stay within what the site
actually promises.

**`/` — homepage.** Currently inherits the root default
([`apps/site/src/app/layout.tsx:24`](../../apps/site/src/app/layout.tsx)) and
has no `metadata` export of its own. The existing root title and description
are good and were carefully written — the description was specifically revised
to remove a timing claim the FAQ refuses to make. Keep that copy; add a
page-level export so `/` gets its own canonical and OG entry rather than
inheriting.

One thing is now legitimately available that was not before: the page itself
says "Live in Pune" in the Coverage section
([`apps/site/src/app/page.tsx:312`](../../apps/site/src/app/page.tsx)), so a
title or description naming Pune would describe the page rather than get ahead
of it — e.g. `mivikto.store — Let shops in Pune compete for your order`. This
is a genuinely new option, not a requirement; weigh it against the fact that
the current brand-forward title works for a one-city, one-category pilot and a
city name in the title is a bigger commitment to reverse than one in a footer
line. Whoever ships this should also decide whether the OG title should match.

**`/privacy`** — currently `title: "Privacy"`, rendering as
`Privacy · mivikto.store`. Suggest `Privacy — what we do with your phone number`.
The page's strongest content is precisely that, it matches a real trust query,
and it reads better in a result than a one-word label.

**`/terms`** — currently `title: "Terms"`. Suggest
`Terms — how deals, bids and commission work`. Same reasoning; also catches
brand-plus-commission queries, without stating a rate.

Both also need `openGraph` overrides — today they inherit the root OG title and
description, so a shared `/privacy` link previews as the homepage.
