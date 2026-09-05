# SEO backlog

Prioritised by impact per unit of effort at pilot stage. Findings referenced as
`B1`–`B5` and `H1`–`H6` map to [technical-audit.md](technical-audit.md).

Revised 2026-09-05: `PILOT_CITY` was set to `"Pune"` the same day, resolving B3
and the old "set `PILOT_CITY`" item (now item 17, marked done below).
Re-prioritised accordingly — two cheap, newly-legitimate items moved into Tier
2 (15, 16) — and added an explicit density gate for location and category
pages in Tier 4.

**No Jira tickets exist for any of this.** Items are named, not numbered. Open a
ticket before citing a number, and verify state against the repo rather than the
board.

## Ownership seams

| Area | Owner |
|---|---|
| Metadata, sitemap, robots, JSON-LD, public copy | `seo` |
| Component structure, styling, the FAQ render change (H1) | `frontend-pwa`, with `seo` specifying the requirement |
| Domain redirects, preview noindex, Search Console, CI | `infra-devops` |
| Anything stating a commission rate | `business` — the rate is open (spec §10) |
| Whether to fund a content programme | `product-owner` and the business owner |

`apps/site` has no owning agent. `frontend-pwa` is scoped to the `apps/web`
customer and shop-owner flows and does not mention the marketing site. Close that
gap deliberately.

**SEO should not be its own epic right now.** This is metadata, sitemaps, schema
and copy hygiene on a three-page site — a slice, not an epic. Revisit when
programmatic location pages become real post-pilot, because that genuinely is a
content-ops workstream with its own data pipeline.

## Tier 1 — do now, unblocked, cheap

Everything here is city-agnostic, has no content risk, and is more annoying to
retrofit than to do.

1. **`apps/web/src/app/robots.ts` disallowing all crawling.** Highest value per
   line of code in this list. The PWA currently has no "do not index" signal at
   all while being fully crawlable with a duplicated title (B4). Sits alongside
   the existing `manifest.ts`. Do **not** refactor the twelve client routes —
   they should not be indexed, so per-route metadata is not worth it.
2. **`apps/site/src/app/sitemap.ts`.** Three static URLs. Nothing to submit to
   Search Console without it (B1).
3. **`apps/site/src/app/robots.ts`.** Allow all, point at the sitemap (B1).
4. **`metadataBase` in both layouts** — apex for `apps/site`, app subdomain for
   `apps/web`. Removes a build warning and stops OG and canonical URLs resolving
   to localhost (H2).
5. **Self-referencing canonicals** on `/`, `/privacy`, `/terms` (H3).
6. **Fix the nav anchors on the legal pages** (H5). A one-line change, and a real
   user-facing bug: the entire header and footer nav is dead on two of three
   pages. `not-found.tsx` already has the correct form to copy.
7. **Verify preview-deployment noindex** in the Vercel dashboard for both
   projects, and record the answer in the repo. If the platform default does not
   cover it, add an `X-Robots-Tag` in `headers()` gated on
   `process.env.VERCEL_ENV === "preview"`. For `apps/web` this goes inside the
   config object passed to the Serwist wrapper, not layered after it.
   Owner: `infra-devops`.
8. **Google Search Console verification** for the apex, and submit the sitemap.
   Free. Without it we have no idea what is indexed. Owner: `infra-devops`.

## Tier 2 — do now, slightly more work

9. **Fix the FAQ so both tabs render (H1).** ~400 words of the site's best
   shop-owner copy is invisible to search and to no-JS users. Render both lists
   and hide the inactive one with CSS, or drive the tab from the URL fragment.
   Needs `frontend-pwa`; the second option also gives shop-owner FAQ content a
   linkable address.
10. **Ship `FAQPage` and `WebSite` JSON-LD**, and `Organization` without
    `contactPoint`. Do this *after* item 9 so the markup matches what the page
    actually renders. See [structured-data.md](structured-data.md).
11. **Create the OG image and a favicon** for `apps/site` (H4). This means
    creating `apps/site/public/`, which does not exist. WhatsApp and social
    sharing are a major discovery channel for this audience and the card is
    currently text-only. The same asset unblocks `Organization.logo`.
    Add a `twitter` card block at the same time.
12. **Page-level metadata for `/`, `/privacy` and `/terms`** — see the concrete
    title suggestions in [keyword-map.md](keyword-map.md). Keep the existing root
    copy; it was carefully written to avoid a timing claim the FAQ refuses to
    make.
13. **Link `apps/web` back to the apex** (H6), and add `/privacy` and `/terms`
    links to the PWA — which the terms page already refers to, so this is a legal
    gap as much as an SEO one.
14. **Add analytics to `apps/site`.** The primary SEO surface has none. Consider
    `@vercel/speed-insights` for field Core Web Vitals; neither app has it.
15. **A geo-qualified title and description pass on `/`.** Newly available, not
    newly required — `PILOT_CITY` is `"Pune"` as of 2026-09-05
    ([`apps/site/src/lib/site.ts:32`](../../apps/site/src/lib/site.ts)) and the
    Coverage section already says "Live in Pune"
    ([`apps/site/src/app/page.tsx:312`](../../apps/site/src/app/page.tsx)), so a
    title naming Pune would describe the page rather than get ahead of it. See
    the concrete option in [keyword-map.md](keyword-map.md). Weigh it against
    the current brand-forward title before shipping — a city name in the title
    is a bigger commitment to reverse than one in a footer section.
16. **`Organization` JSON-LD gains `areaServed: "Pune"`.** Ship alongside item
    10 above, or as a follow-up to it if 10 already shipped without it. See
    [structured-data.md](structured-data.md).

## Tier 3 — still blocked, on a real phone line, not on the city

Item 15 in this tier used to be "set `PILOT_CITY`." That is done — see below.
The city decision resolved B3, but it does not resolve B2, and B2 is now the
single blocker behind everything else in this tier.

17. **~~Set `PILOT_CITY`~~ — done, 2026-09-05.** `PILOT_CITY` is `"Pune"`
    ([`apps/site/src/lib/site.ts:32`](../../apps/site/src/lib/site.ts)),
    closing spec §10 open decision #1. See
    [technical-audit.md](technical-audit.md) finding B3 for exactly what this
    did and did not unblock — it is not everything that was filed under "wait
    for the city" before today.
18. **Replace the placeholder phone and email** (B2). Still blocked on a real
    staffed line, not on code, and not on the city — `example.com` is still
    rendering on every public page. This is now the binding blocker behind
    `Organization.contactPoint`, any Google Business Profile, and any future
    reconsideration of on-page contact trust signals. Nothing about the Pune
    decision moves this forward.
19. **A Google Business Profile for mivikto.** Blocked on item 18, not on the
    city and not on shop density — a profile needs a real, verifiable phone
    number and address, neither of which exists yet. For "near me" queries this
    is likely worth more than anything on-page; see [strategy.md](strategy.md).
    Note this is a profile for **mivikto**, not for any individual shop — see
    [structured-data.md](structured-data.md) on why per-shop listings are off
    the table regardless of density.

## Tier 4 — post-pilot, needs a decision first

20. **Tier B advice content.** The realistic organic wedge, and a genuine
    unbudgeted cost — spec §8 has no marketing or content line. Needs the
    business owner to fund it, not an engineer to start it.
21. **Location and category pages** — explicitly gated, and explicitly not
    ready. A read-only query of the production database on 2026-09-05 found 11
    shops total in Pune, 3 verified, and only 4 within a generous 25 km ring of
    the city centre — a ring far wider than the 5 km default matching radius
    (spec §2) a real location page would promise — all 11 in the single MVP
    category. 22 requests and 8 deals exist all-time, city-wide. That is
    zero or one shop per named Pune locality, not counted per 5 km radius.

    **Proposed density gate** (a product and business call to formally adopt,
    not a measured figure — treat the numbers themselves as a starting proposal
    rather than a finding): a locality or category page should not ship until
    that locality/category combination sustains **at least 5 active, verified,
    bidding shops within its matching radius** and **at least 5 completed deals
    sourced from that radius in a trailing 90-day window.** Below that, a
    posted request has a real chance of reaching nobody, which is a worse
    outcome for the visitor than never having found the page, and mass-
    generating pages at sub-threshold density across Pune's localities would
    read as templated doorway pages to a crawler — a risk to the whole
    domain's trust, not just wasted effort on the pages themselves (see
    [technical-audit.md](technical-audit.md) B3 and [README.md](README.md)).

    At today's count — 4 shops in a 25 km ring, single category — **every
    locality in Pune fails this gate**, and pages stay unbuilt until real usage
    data says otherwise. Re-check this number periodically as the pilot
    progresses; do not build ahead of it.
22. **A dedicated `/for-shops` route**, once the shop-owner FAQ is crawlable and
    the acquisition model in spec §10 is decided.
23. **CI Lighthouse budget.** There is no `.github/workflows` at all today, so
    this means standing up CI from scratch. Reasonable to defer until there are
    more pages worth protecting. GitHub Actions free tier covers a repo this
    size, so no meaningful rupee cost.
24. **Hindi and regional-language content.** No i18n framework in the stack
    (spec §6), so this is a real build. Start with Hinglish variants inside the
    existing English pages.

## Explicitly not doing

- **Removing `"use client"` from the `apps/web` routes for SEO.** Those pages
  should not be indexed. A robots signal is the correct fix.
- **Category pages.** MVP is single-category (spec §4, §9); there is no axis.
- **Per-shop `LocalBusiness` or directory-style markup, at any shop count.**
  Shop identity is hidden from the customer until a deal locks — a revenue
  guardrail (spec §2, §5), not a data-availability gap — so this does not get
  revisited as supply grows. See [structured-data.md](structured-data.md).
- **Link building or directory campaigns.** Premature pre-launch.
- **Publishing any commission figure** in metadata, copy or schema. Open decision
  (spec §10), and billing is still in shadow mode with nobody charged — see
  [`BACKLOG-monetization.md`](../../BACKLOG-monetization.md).
- **Targeting the reverse-auction vocabulary for traffic.** Near-zero demand.
  Keep it as conversion copy, not as a ranking target — see
  [strategy.md](strategy.md).

## Cost

Every Tier 1 and Tier 2 item is Next.js or Vercel configuration on the existing
free tier, plus Search Console, which is free. **Nothing in Tier 1 or 2 touches
the ~₹2,500–12,000/month band in spec §8**, and nothing in this backlog affects
the Google Maps line that the spec flags as the real cost risk.

Tier 4 content work is the first item with a real budget implication, and spec §8
has no line for it at all.
