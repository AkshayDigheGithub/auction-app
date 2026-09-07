# SEO documentation

Organic search documentation for mivikto.store, the hyperlocal reverse-auction
marketplace described in [`mvp-spec-hyperlocal-bid-app_1.md`](../../mvp-spec-hyperlocal-bid-app_1.md).

Written 2026-09-05, against commit `598514a`. Revised the same day, after
`PILOT_CITY` was set to `"Pune"` — see fact 1 below and
[technical-audit.md](technical-audit.md) (finding B3) for what that did and did
not unblock.

## The documents

| Document | What it answers |
|---|---|
| [strategy.md](strategy.md) | Who we are trying to reach, what they search for, and how much organic is actually worth at pilot stage |
| [technical-audit.md](technical-audit.md) | What the code does today, what is missing, with file and line evidence |
| [keyword-map.md](keyword-map.md) | Which query maps to which page, and which pages do not exist yet |
| [structured-data.md](structured-data.md) | The JSON-LD we can honestly publish, and the markup we must not |
| [backlog.md](backlog.md) | Prioritised work, gated by what is and is not decided |

## Read this first

Three facts shape every recommendation in here, and if any of them changes the
documents need revisiting:

1. **The pilot city is Pune — but shop density there is thin, and that is now
   the real constraint.** `PILOT_CITY` was set to `"Pune"` in
   [`apps/site/src/lib/site.ts:32`](../../apps/site/src/lib/site.ts) on
   2026-09-05, closing spec §10 open decision #1. That switches the homepage
   Coverage section from "we are onboarding shops right now" to "Live in Pune"
   ([`apps/site/src/app/page.tsx:312`](../../apps/site/src/app/page.tsx)) and
   unblocks every piece of geo-qualified copy that was previously waiting on a
   real place name.

   It does **not** unblock location or category landing pages, and it does not
   make `LocalBusiness` markup safe to publish. A direct, read-only query of the
   production database on 2026-09-05 found 11 shops total, 3 verified, all 11
   with a location set but only 4 within a generous 25 km ring of Pune's centre
   — and every one of the 11 in the single MVP category, `mobile_electronics`.
   22 requests and 8 deals have been posted all-time. Four shops spread across a
   25 km ring means most named Pune localities — Kothrud, Koregaon Park,
   Hadapsar, Viman Nagar, Baner, and the rest — would carry zero or one shop
   each. A page built on that density is thin content, and at pilot stage it
   reads as a doorway page to a search engine: a live ranking risk to the whole
   domain, not merely wasted writing effort. **The binding constraint on
   location and category pages is now shop density, not the city decision** —
   see the gate in [backlog.md](backlog.md), and revisit this fact again if
   density crosses it.
2. **Organic traffic outside the bid radius is worth approximately nothing.**
   A deal can only close when a shop within the matching radius (5 km default,
   spec §2) bids on it. A visitor from another city converts to zero revenue,
   because revenue only accrues on confirmed deals (spec §5). This is what makes
   SEO a secondary channel here rather than a primary one.
3. **SEO is not its own epic.** At this stage the work is metadata, sitemaps,
   structured data and copy hygiene on a three-page site. See
   [backlog.md](backlog.md) for the ownership seams.

## Ownership

The `seo` agent ([`.claude/agents/seo.md`](../../.claude/agents/seo.md)) owns the
content of these documents and the metadata, sitemap, robots, structured data
and public copy that they describe.

It does not own component structure or styling (`frontend-pwa`), hosting,
redirects and domain configuration (`infra-devops`), or anything that states a
commission rate (`business` — the rate is an open decision, spec §10).

`apps/site` has no owning agent today. `frontend-pwa` is scoped to the customer
and shop-owner flows in `apps/web` and does not mention the marketing site. That
gap should be closed deliberately rather than by whoever touches it next.

## No ticket numbers here

No Jira tickets have been opened for any of this work. Work items are referred
to by name only. Open a ticket before citing a number, and check the repo rather
than the board for current state.
