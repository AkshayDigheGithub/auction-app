# SEO backlog

Prioritised by impact per unit of effort at pilot stage. Findings referenced as
`B1`–`B5` and `H1`–`H6` map to [technical-audit.md](technical-audit.md).

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

## Tier 3 — after the pilot city is decided

All of these are blocked on spec §10 item 1, not on engineering time. Nothing
here should be unblocked by inventing a city.

15. **Set `PILOT_CITY`** and let the geo-qualified copy through (B3).
16. **Replace the placeholder phone and email** (B2). Blocked on a real staffed
    line, not on code. Until then `example.com` is rendering on every public page.
17. **`LocalBusiness` structured data** and a Google Business Profile. For "near
    me" queries the profile is likely worth more than anything we do on-page.
18. **A geo-qualified title and description pass** once a city name is legitimate.

## Tier 4 — post-pilot, needs a decision first

19. **Tier B advice content.** The realistic organic wedge, and a genuine
    unbudgeted cost — spec §8 has no marketing or content line. Needs the
    business owner to fund it, not an engineer to start it.
20. **Location pages**, gated on the supply threshold in
    [keyword-map.md](keyword-map.md): a minimum of active bidding shops in the
    radius *and* a minimum of completed deals in a trailing window. Set the
    numbers from real pilot data.
21. **A dedicated `/for-shops` route**, once the shop-owner FAQ is crawlable and
    the acquisition model in spec §10 is decided.
22. **CI Lighthouse budget.** There is no `.github/workflows` at all today, so
    this means standing up CI from scratch. Reasonable to defer until there are
    more pages worth protecting. GitHub Actions free tier covers a repo this
    size, so no meaningful rupee cost.
23. **Hindi and regional-language content.** No i18n framework in the stack
    (spec §6), so this is a real build. Start with Hinglish variants inside the
    existing English pages.

## Explicitly not doing

- **Removing `"use client"` from the `apps/web` routes for SEO.** Those pages
  should not be indexed. A robots signal is the correct fix.
- **Category pages.** MVP is single-category (spec §4, §9); there is no axis.
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
