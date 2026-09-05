# Technical SEO audit

State of the code as of 2026-09-05, commit `598514a`, revised the same day
after `PILOT_CITY` was set to `"Pune"` (B3, below). Every finding carries file
and line evidence. Severity is impact on organic search, not on the product.

Two apps are in scope:

- **`apps/site`** — the marketing site on the apex `mivikto.store`. Three
  indexable URLs. This is essentially the entire SEO surface.
- **`apps/web`** — the PWA on `app.mivikto.store`. Almost entirely behind auth,
  and every route is a client component.

## Blockers

### B1 — No robots.txt or sitemap on either domain

Neither app has `app/sitemap.ts` or `app/robots.ts`, and neither serves a static
equivalent — `apps/site` has no `public/` directory at all, and `apps/web/public/`
holds only the two PWA icons, the Next.js starter SVGs and `sw.js`.

The only robots directive in the entire repository is
[`apps/site/src/app/not-found.tsx:8`](../../apps/site/src/app/not-found.tsx).

Consequence: nothing to submit to Search Console, and no crawl guidance anywhere.

### B2 — Placeholder contact details are live on every public page

`CONTACT_PHONE` is `+91 00000 00000` and `CONTACT_EMAIL` is `hello@example.com`
in [`apps/site/src/lib/site.ts:52-53`](../../apps/site/src/lib/site.ts). Both
render in the footer on every page, plus the 404, the error page, `/privacy`
and `/terms`.

The comment above them already says to replace them before the site goes public.
Beyond the trust cost of shipping an `example.com` address to a phone-first
audience that the spec says trusts a voice on the line (spec §4), this blocks
`Organization.contactPoint` markup and any NAP consistency with a Google
Business Profile.

**Blocked on a real staffed phone line, not on engineering.**

### B3 — Resolved: PILOT_CITY is set, but the site cannot outrun its own shop count

[`apps/site/src/lib/site.ts:32`](../../apps/site/src/lib/site.ts) sets
`PILOT_CITY` to `"Pune"` as of 2026-09-05, closing spec §10 open decision #1.
This is a real change, not cosmetic: the Coverage section on the homepage now
renders "Live in Pune" instead of the placeless "We are onboarding shops right
now" ([`apps/site/src/app/page.tsx:312`](../../apps/site/src/app/page.tsx)) —
a public claim that the product works for someone standing in Pune, and the
first geo-qualified sentence to exist anywhere on the site.

**What this newly unblocks:** any title, description, heading or JSON-LD that
names Pune honestly. Concretely, that is backlog Tier 2 items 15–16 (a
geo-qualified metadata pass on `/`, and `areaServed: "Pune"` on `Organization`
JSON-LD) — both cheap, both unblocked outright, not merely re-gated. A Google
Business Profile (Tier 3 item 19) moves from "blocked on the city" to "blocked
on B2," a real staffed phone number — a different and smaller problem, but
still a blocker. `LocalBusiness` markup for the platform itself is not on this
list at all: it needs a physical premises mivikto does not have, city or no
city, and per-shop markup is off the table permanently on design grounds, not
data grounds. See [structured-data.md](structured-data.md) and
[keyword-map.md](keyword-map.md) for exactly what changed on each.

**What this does not unblock:** location or category landing pages, or full
`LocalBusiness` markup with an address and geo coordinates. A direct, read-only
query of the production database on 2026-09-05 found 11 shops total, 3
verified, all 11 with a location set, but only 4 within a generous 25 km ring
of Pune's centre — and all 11 in the single MVP category, `mobile_electronics`.
22 requests and 8 deals exist all-time. Four shops spread across a 25 km ring
means most named Pune localities — Kothrud, Koregaon Park, Hadapsar, Viman
Nagar, Baner, and the rest — would carry zero or one shop each. A page built on
that density is thin content by Google's own definition, and at pilot stage it
reads as a doorway page: a live ranking risk to the whole domain, not merely
wasted writing effort.

**The binding constraint on this workstream is now shop density, not the city
decision.** The comment above `PILOT_CITY` in `site.ts` already anticipates the
reverse of this: if density in Pune ever falls back to the point a posted
request routinely reaches nobody, the value goes back to `null` rather than the
copy being softened around it. The same discipline applies one level down — no
locality gets named in copy or markup until it clears the gate in
[backlog.md](backlog.md).

### B4 — apps/web is fully indexable, with one duplicated title

No `robots.ts`, no per-route robots metadata, no `X-Robots-Tag`. Meanwhile every
route file under `apps/web/src/app` opens with `"use client"` — `page.tsx`,
`login/`, `nearby/`, `onboard/`, `admin/`, `deal/[id]/`, `request/[id]/`,
`request/mine/`, `request/new/`, `scan/`, `wallet/`, `sso-callback/`.

Two consequences. Client components cannot export `metadata`, so all public app
routes serve the identical title and description from
[`apps/web/src/app/layout.tsx:22`](../../apps/web/src/app/layout.tsx). And a
crawler receives an app shell with no content.

The marketing CTAs point at indexable query-string variants of `/login`
([`apps/site/src/lib/site.ts:42`](../../apps/site/src/lib/site.ts)), on a domain
with no crawl controls.

Fix the robots signal. Do **not** remove `"use client"` from twelve routes for
SEO — these pages should not be indexed at all, so per-route metadata is not
worth a refactor of the product.

### B5 — Zero structured data

No `application/ld+json` and no schema.org markup anywhere in the repo, confirmed
by a sweep across all of `apps/` plus the root config files.

This is a missed opportunity rather than a defect, and an unusually cheap one:
[`apps/site/src/components/faq.tsx:18`](../../apps/site/src/components/faq.tsx)
onward already holds 14 question-and-answer pairs as plain string arrays —
schema-ready shape, no markup to strip. See [structured-data.md](structured-data.md).

## High

### H1 — Eight FAQ answers are never in the HTML

[`apps/site/src/components/faq.tsx:81`](../../apps/site/src/components/faq.tsx)
holds the active tab in `useState` and renders only one list, selecting between
`CUSTOMER_FAQ` and `SHOP_FAQ` on the client.

The server-rendered HTML contains the 6 customer questions. The 8 shop-owner
questions — roughly 400 words, and the most objection-handling copy on the site —
are never crawlable, and are invisible to a user with JS disabled.

This is also precisely the copy that would serve the shop-owner audience in
search. Render both lists and hide the inactive one with CSS, or drive the tab
from a URL fragment. Worth coordinating with `frontend-pwa`, since it changes
component structure.

### H2 — No metadataBase, so OG and canonical URLs resolve to localhost

Neither [`apps/site/src/app/layout.tsx:24`](../../apps/site/src/app/layout.tsx)
nor [`apps/web/src/app/layout.tsx:22`](../../apps/web/src/app/layout.tsx) sets it.
Next.js falls back to `http://localhost:3000` when resolving relative OG and
canonical URLs, and warns at build time.

### H3 — No canonical URLs anywhere

No `alternates.canonical` in any metadata export. Apex, `www` and the
`*.vercel.app` alias cannot be consolidated, and there is no configuration in the
repo that tells us which host is canonical — no `redirects` or `headers` block in
the root `vercel.json`, `apps/site/vercel.json`, or either `next.config.ts`.
Domain binding lives in the Vercel dashboard, outside version control, which
means a reviewer cannot verify from this repo whether `www` even redirects.

### H4 — No social preview image, and no image assets at all

`apps/site` has no `public/` directory, no `opengraph-image`, no `icon`, no
`favicon.ico`. The apex favicon 404s, and link previews render as a bare text
card. There is no `twitter` card block either, so X falls back to the OG tags —
which have no image.

This is a *consequence* of a good decision, not a careless one: the site
deliberately uses a CSS gradient rather than a hero image so it costs nothing to
load ([`apps/site/src/app/page.tsx:24`](../../apps/site/src/app/page.tsx)). But
WhatsApp and social sharing are a major discovery channel for this audience, and
a text-only card measurably costs click-through.

### H5 — The header and footer nav are dead links on /privacy and /terms

`NAV_LINKS` are bare fragments — `#how-it-works`, `#for-shops`, `#pricing`,
`#faq` ([`apps/site/src/lib/site.ts:63`](../../apps/site/src/lib/site.ts)) —
passed straight to `Link` in
[`apps/site/src/components/site-header.tsx:20`](../../apps/site/src/components/site-header.tsx)
and the footer. On `/privacy` they resolve to `/privacy#how-it-works`, an anchor
to an id that does not exist on that page.

[`apps/site/src/app/not-found.tsx:65`](../../apps/site/src/app/not-found.tsx) gets
it right by prefixing the fragment with a slash, which confirms this is an
oversight rather than a convention. It is a genuine user-facing bug as much as an
SEO one.

### H6 — apps/web never links back to the apex

Searching for `mivikto.store` in `apps/web/src` returns only string literals. The
header wordmark links to the app root, not to the marketing site, and there are
no `/privacy` or `/terms` links anywhere in the PWA — despite the terms page
referring to them. The app subdomain passes no authority back to the apex.

## Medium

- **No analytics on the primary SEO surface.** `apps/web` ships
  `@vercel/analytics` ([`apps/web/src/app/layout.tsx:10`](../../apps/web/src/app/layout.tsx));
  `apps/site` ships nothing. No Search Console verification, no field Core Web
  Vitals for the apex. `@vercel/speed-insights` is not installed in either app.
- **No CI at all.** There is no `.github/workflows` directory, so nothing would
  catch an accidental site-wide `noindex` before it shipped.
- **Vercel preview deployments have no repo-level noindex.** Nothing in either
  `vercel.json` or `next.config.ts` handles previews; this relies entirely on the
  platform default, which should be verified in the dashboard for both projects.
- **Section labels sit outside the document outline.** The `Eyebrow` component
  ([`apps/site/src/components/sections.tsx:19`](../../apps/site/src/components/sections.tsx))
  renders the visually-primary label — "How it works", "Pricing", "Questions" —
  as a paragraph above the `h2`.
- **No h3 tier exists.** Every subsection title that should be an `h3` is a
  paragraph: the step-track labels, the four trust-point cards, the pricing tier
  labels, the final CTA cards
  ([`apps/site/src/app/page.tsx`](../../apps/site/src/app/page.tsx) around lines
  165, 236, 261, 270, 280, 338 and 353). FAQ questions are a `span` inside
  `summary`.
- **The homepage has no `metadata` export**, so `/` inherits root defaults and
  has no page-specific OG or canonical.
- **Thin internal link graph.** No in-body link from `/` to `/privacy` or
  `/terms`; the only path is the shared footer.

## What is already right

Worth recording so nobody "fixes" it:

- **Headings on `/` are structurally sound at the top level** — exactly one `h1`
  ([`apps/site/src/app/page.tsx:44`](../../apps/site/src/app/page.tsx)), five
  `h2`s, no skipped levels. `/privacy` and `/terms` are clean.
- **Rendering is static and server-first.** Only two client components on the
  marketing site — the mobile menu and the FAQ tabs. No `dynamic` or `revalidate`
  exports, so everything is static output. Ideal for crawl budget.
- **Fonts are self-hosted via `next/font/google` with `display: "swap"`** — no
  render-blocking third-party CSS, no invisible-text flash.
- **Zero images means near-zero layout shift**, and the LCP element is the `h1`
  text. For an audience on mid-range Android over patchy connectivity this is the
  right trade, even though it is why H4 exists.
- **The service worker cannot serve stale marketing copy.** `apps/site` registers
  none, and the separation is deliberate and documented in
  [`apps/site/next.config.ts`](../../apps/site/next.config.ts). The `apps/web`
  worker is browser-side interception and does not affect crawlers.
- **The 404 is correctly noindexed** while staying `follow`.
- **Legal pages are genuinely substantial** — roughly 750 and 800-plus words of
  specific, non-boilerplate prose. The passage in `/privacy` on who can see your
  phone number is real differentiated content.
