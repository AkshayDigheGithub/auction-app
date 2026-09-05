# Keyword map

Which query belongs to which page. Read [strategy.md](strategy.md) first — the
tier definitions and the competitive picture are there.

## Standing caveats

- **No search volumes appear in this document.** We have no keyword-tool data.
  Every judgement below is qualitative and needs validating against Google
  Keyword Planner or Ahrefs once the pilot city is fixed.
- `<city>` and `<area>` are placeholders. `PILOT_CITY` is `null`
  ([`apps/site/src/lib/site.ts:29`](../../apps/site/src/lib/site.ts)), so no
  geo-qualified term can be targeted yet. Do not substitute a guess.
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
[`apps/site/src/lib/site.ts:52`](../../apps/site/src/lib/site.ts) — one city, one
category, thin content on both sides, so two half-empty pages would be worse than
one. It is the right call now, and it is also the ceiling on what the site can
rank for. Splitting is a post-pilot decision driven by scroll and search data.

## Intent tiers, mapped

### Tier A — product and local intent

`iphone 15 price in <city>` · `mobile shop near me` · `electronics store <area>`
· `best mobile shop in <city>`

**Owned by:** Google's local pack, Amazon and Flipkart, price-comparison portals.

**Our position:** no page targets these and none should yet. These need a
location or category page with real supply behind it — see the gating rule
below. **Blocked on B3** (no pilot city).

The honest read is that we will not beat the local pack at "near me" on our own
pages. When the city is chosen, a Google Business Profile is likely worth more
than any page we write for this tier.

### Tier B — comparison and advice

`how to get the best price on a phone in <city>` · `cheapest place to buy a
phone <city>` · `should I buy a phone online or from a shop` · `how to negotiate
phone price`

**Owned by:** loosely held. Price-comparison portals cover the transactional
edge; the advice edge is thin.

**Our position:** this is the realistic wedge. It is informational, so it
converts worse per visit, but it is winnable and it maps onto content we can
write truthfully today. Still better served after the city is fixed, because
the advice is only useful to someone who can act on it locally.

**No page exists for this tier.** It would be the first genuine reason to add a
route beyond the current three — and the first thing that starts to look like a
content programme, which spec §8 does not budget for. Do not start it without
that being an explicit business decision.

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
`sell mobile phones online <city>` · `indiamart alternative for small shops`

**Our position:** served today only by the `#for-shops` anchor on the homepage —
and **half of the relevant FAQ copy is not even in the HTML** (finding H1). Fixing
H1 is the cheapest improvement available to this audience.

Note the standing caveat from [strategy.md](strategy.md): spec §10 leaves
shop-owner acquisition (manual outreach vs self-serve) undecided, so keep this
side cheap until that lands.

## Pages we do not have, and when to build them

### Location pages — gated on supply, not on effort

A locality page with two shops and no completed deals is thin content by Google's
definition and looks broken to a real visitor. Both failure modes are worse than
having no page.

**Proposed gate**, to be set with real pilot data rather than guessed now:

- a minimum count of active, bidding shops within the locality's matching radius
  (5 km default, spec §2 — itself an open decision per §10), **and**
- a minimum count of completed deals in a trailing window.

The actual numbers are a business and product call once there is usage to look
at. What is firm is the shape: **no page ships for a locality that cannot serve
the promise the page makes.**

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

**`/` — homepage.** Currently inherits the root default and has no `metadata`
export of its own. The existing root title and description are good and were
carefully written — the description was specifically revised to remove a timing
claim the FAQ refuses to make. Keep the copy; add a page-level export so `/`
gets its own canonical and OG entry rather than inheriting.

**`/privacy`** — currently `title: "Privacy"`, rendering as
`Privacy · mivikto.store`. Suggest `Privacy — what we do with your phone number`.
The page's strongest content is precisely that, it matches a real trust query,
and it reads better in a result than a one-word label.

**`/terms`** — currently `title: "Terms"`. Suggest
`Terms — how deals, bids and commission work`. Same reasoning; also catches
brand-plus-commission queries, without stating a rate.

Both also need `openGraph` overrides — today they inherit the root OG title and
description, so a shared `/privacy` link previews as the homepage.
