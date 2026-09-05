# SEO documentation

Organic search documentation for mivikto.store, the hyperlocal reverse-auction
marketplace described in [`mvp-spec-hyperlocal-bid-app_1.md`](../../mvp-spec-hyperlocal-bid-app_1.md).

Written 2026-09-05, against commit `598514a`.

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

1. **The pilot city is not chosen.** `PILOT_CITY` is `null` in
   [`apps/site/src/lib/site.ts:29`](../../apps/site/src/lib/site.ts), and spec §10
   lists the city as an open decision. A hyperlocal product with no place name
   in its copy cannot rank for a geo-qualified query. Most of the high-value SEO
   work is genuinely blocked on this, not on engineering time.
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
