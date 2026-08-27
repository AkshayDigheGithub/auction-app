import { Faq } from "@/components/faq";
import { Card, Eyebrow, Heading, Lead, Section } from "@/components/sections";
import { CUSTOMER_LOGIN_URL, PILOT_CITY, SHOP_LOGIN_URL } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyDifferent />
      <Pricing />
      <Coverage />
      <Faq />
      <FinalCta />
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      {/* Warm wash behind the headline. Kept as CSS rather than an image so the
          hero costs nothing to load and never shifts as it paints. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_32rem_at_50%_-8rem,var(--color-brand-100),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent"
      />

      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
          </span>
          Onboarding shops now
        </span>

        <h1 className="font-display mt-6 text-4xl font-bold leading-[1.08] text-ink-900 sm:text-6xl">
          Let nearby shops
          <br />
          <span className="text-brand-600">compete for your order</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
          Post what you want to buy and your area. Shops near you send their best price. Pick one and collect it in
          person — no calling five shops, no walking the market comparing quotes.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={CUSTOMER_LOGIN_URL}
            className="w-full rounded-full bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 sm:w-auto"
          >
            Get bids near you
          </a>
          <a
            href="#for-shops"
            className="w-full rounded-full border border-ink-200 bg-white px-7 py-3.5 text-base font-semibold text-ink-800 transition hover:border-ink-400 sm:w-auto"
          >
            I run a shop
          </a>
        </div>

        <p className="mt-5 text-sm text-ink-500">
          Free for buyers. Nothing to install — it runs in your browser.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- how it works */

const CUSTOMER_STEPS = [
  {
    title: "Say what you want",
    body: "The product and your area. That is the whole form — it takes about a minute.",
  },
  {
    title: "Watch the prices come in",
    body: "Shops near you send their best offer. You see them arrive live, cheapest first.",
  },
  {
    title: "Pick one and collect it",
    body: "Lock the bid you like, show the QR code at the shop, and pay them directly.",
  },
];

const SHOP_STEPS = [
  {
    title: "See who is buying nearby",
    body: "Real requests from people in your area who are ready to buy — not a directory listing.",
  },
  {
    title: "Send your price",
    body: "Bid what works for your margin. Other shops never see your number.",
  },
  {
    title: "Scan to confirm",
    body: "The customer arrives with a QR code. Scan it with your phone camera and the deal is closed.",
  },
];

function HowItWorks() {
  return (
    <Section id="how-it-works" className="bg-white">
      <div className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <Heading className="mt-3">Two sides of the same minute</Heading>
        <Lead className="mt-4">
          A customer posts once. Every shop nearby that sells it gets a chance to win the sale.
        </Lead>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <StepTrack
          label="If you are buying"
          steps={CUSTOMER_STEPS}
          tone="brand"
          cta={{ href: CUSTOMER_LOGIN_URL, label: "Post your first request" }}
        />
        <StepTrack
          label="If you run a shop"
          steps={SHOP_STEPS}
          tone="ink"
          id="for-shops"
          cta={{ href: SHOP_LOGIN_URL, label: "List your shop" }}
        />
      </div>
    </Section>
  );
}

function StepTrack({
  label,
  steps,
  tone,
  id,
  cta,
}: {
  label: string;
  steps: { title: string; body: string }[];
  tone: "brand" | "ink";
  id?: string;
  /* Each track ends in its own entry point. The hero's "I run a shop" button
     scrolls here, so without this the shop owner arrives at an explanation and
     then has nowhere to go. */
  cta?: { href: string; label: string };
}) {
  const badge =
    tone === "brand" ? "bg-brand-600 text-white" : "bg-ink-900 text-white";
  return (
    <div
      id={id}
      className={`scroll-mt-24 rounded-2xl border p-7 sm:p-8 ${
        tone === "brand" ? "border-brand-200 bg-brand-50/60" : "border-ink-200 bg-ink-100/60"
      }`}
    >
      <p className="font-display text-xl font-bold text-ink-900">{label}</p>
      <ol className="mt-6 flex flex-col gap-6">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${badge}`}
            >
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-ink-900">{s.title}</p>
              <p className="mt-1 leading-relaxed text-ink-600">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {cta && (
        <a
          href={cta.href}
          className={`mt-7 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition ${
            tone === "brand" ? "bg-brand-600 hover:bg-brand-700" : "bg-ink-900 hover:bg-ink-800"
          }`}
        >
          {cta.label}
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------- why different */

/*
 * Every claim here is something the product actually does today and a visitor
 * could verify in one session. Nothing aspirational, nothing about verification
 * being a guarantee, no invented statistics.
 */
const TRUST_POINTS = [
  {
    title: "Bidding is blind",
    body: "Shops cannot see each other's prices — only you can. Nobody is undercutting a number on a screen; each shop quotes against its own margin.",
  },
  {
    title: "Your number stays yours",
    body: "While shops are bidding they see the product, your rough area and the distance. Not your name, not your phone number.",
  },
  {
    title: "A deal is only done in person",
    body: "You show a QR code at the shop and they scan it. Nothing is confirmed by either side clicking a button remotely.",
  },
  {
    title: "No app, no account fees",
    body: "It runs in a browser on any phone. Add it to your home screen if you like — there is nothing to download.",
  },
];

function WhyDifferent() {
  return (
    <Section>
      <div className="max-w-2xl">
        <Eyebrow>Why this is different</Eyebrow>
        <Heading className="mt-3">Built to be checkable</Heading>
        <Lead className="mt-4">
          It is a reverse auction, not a directory. Here is exactly what that means in practice.
        </Lead>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {TRUST_POINTS.map((p) => (
          <Card key={p.title}>
            <p className="font-display text-lg font-bold text-ink-900">{p.title}</p>
            <p className="mt-2 leading-relaxed text-ink-600">{p.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- pricing */

function Pricing() {
  return (
    <Section id="pricing" className="bg-white">
      <div className="max-w-2xl">
        <Eyebrow>Pricing</Eyebrow>
        <Heading className="mt-3">What this costs</Heading>
        <Lead className="mt-4">
          One of these is simple and permanent. The other we are still working out, and we would rather say that than
          publish a number we have to take back.
        </Lead>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Card className="border-ink-200">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">If you are buying</p>
          <p className="font-display mt-3 text-4xl font-bold text-ink-900">Free</p>
          <p className="mt-3 leading-relaxed text-ink-600">
            No qualifier on this one. Customers are never charged — not to post, not to receive bids, not to lock a
            deal. You pay the shop for the goods, and nothing to us.
          </p>
        </Card>

        <Card className="border-brand-200 bg-brand-50/50">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">If you run a shop</p>
          <p className="font-display mt-3 text-4xl font-bold text-ink-900">
            Free <span className="text-2xl font-semibold text-ink-500">during the pilot</span>
          </p>
          <p className="mt-3 leading-relaxed text-ink-600">
            No card, no deposit, no listing fee, no charge to bid. There is not currently any way for us to take a
            shop&apos;s money, even if you wanted to hand it over.
          </p>

          <div className="mt-6 border-t border-brand-200 pt-5">
            <p className="text-sm font-semibold text-ink-900">When we do introduce pricing</p>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-ink-600">
              {[
                "It will be a share of a sale you actually won — never a subscription, never a fee per lead.",
                "Rates will differ by what you sell, because a jewellery margin and a hardware margin are not the same thing.",
                "You will see the exact rate before it ever applies to you.",
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink-500">
        We say &ldquo;free during the pilot&rdquo; rather than &ldquo;free&rdquo; on purpose. We intend to charge shops
        eventually, and a promise of &ldquo;free forever&rdquo; is one we would have to break.
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------- coverage */

function Coverage() {
  return (
    <Section>
      <div className="rounded-3xl border border-ink-200 bg-ink-900 px-7 py-12 text-center sm:px-12 sm:py-16">
        <Heading className="!text-ink-50">
          {PILOT_CITY ? `Live in ${PILOT_CITY}` : "We are onboarding shops right now"}
        </Heading>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-ink-400">
          {PILOT_CITY
            ? "If you are outside this area, tell us where you are and we will come to you once there are enough shops nearby to make bidding worth it."
            : "This works when enough shops near you sell what you are asking for, so we are starting in one area and widening from there. It costs you nothing to post a request and find out."}
        </p>
        <a
          href={CUSTOMER_LOGIN_URL}
          className="mt-8 inline-block rounded-full bg-white px-7 py-3.5 text-base font-semibold text-ink-900 transition hover:bg-ink-100"
        >
          Try it with a real request
        </a>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <Section className="bg-white">
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="flex flex-col justify-between gap-6">
          <div>
            <p className="font-display text-2xl font-bold text-ink-900">Looking to buy something?</p>
            <p className="mt-2 leading-relaxed text-ink-600">
              Post it and see what the shops around you come back with. A minute to try, nothing to lose.
            </p>
          </div>
          <a
            href={CUSTOMER_LOGIN_URL}
            className="rounded-full bg-brand-600 px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-brand-700"
          >
            Get bids near you
          </a>
        </Card>

        <Card className="flex flex-col justify-between gap-6">
          <div>
            <p className="font-display text-2xl font-bold text-ink-900">Run a shop?</p>
            <p className="mt-2 leading-relaxed text-ink-600">
              Phone number, shop name, your spot on the map, and what you sell. No documents, no visit, no fee.
            </p>
          </div>
          <a
            href={SHOP_LOGIN_URL}
            className="rounded-full bg-ink-900 px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-ink-800"
          >
            Get customers near you
          </a>
        </Card>
      </div>
    </Section>
  );
}
