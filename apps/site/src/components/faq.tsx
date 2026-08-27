"use client";

import { useState } from "react";
import { Eyebrow, Heading, Section } from "./sections";

interface QA {
  q: string;
  a: string;
}

/*
 * Grouped by audience rather than merged into one list: a shop owner should not
 * have to read reassurance written for customers to find the answer that is
 * actually blocking them. Within each group, ordered by how much the question
 * blocks a signup — the sceptical ones first, not the flattering ones.
 */

const CUSTOMER_FAQ: QA[] = [
  {
    q: "Is it free for me?",
    a: "Yes. Customers are never charged, for anything. There is no fee to post a request, no fee to receive bids, and no fee to lock a deal.",
  },
  {
    q: "Do I have to buy, or can I look and walk away?",
    a: "You can walk away. Posting a request costs nothing and commits you to nothing — you are only choosing a shop when you tap to lock a bid, and even then the purchase happens in person, on your terms.",
  },
  {
    q: "How quickly will I get bids? Is anyone actually out there?",
    a: "Honestly: it depends on how many shops near you sell what you are asking for, and we are still onboarding. We would rather tell you that than promise you bids in five minutes and have your request sit empty. If nothing comes in, you have lost nothing but the minute it took to post.",
  },
  {
    q: "Do shops get my phone number?",
    a: "Not while they are bidding. A shop sees the product you asked for, your rough area and how far away you are — not your name and not your number. You stay anonymous until you choose a bid.",
  },
  {
    q: "What if the shop quotes a different price when I arrive?",
    a: "Report it in the app — there is a button on the deal for exactly this. Be aware of what we can and cannot do today: we can record it against that shop and act on a pattern, but a full dispute process is still being built. We are not going to claim buyer protection we have not built yet.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. It runs in your browser. You can add it to your home screen if you want it to feel like an app, but there is nothing to download and no app store involved.",
  },
];

const SHOP_FAQ: QA[] = [
  {
    q: "Is this really free, or is there a catch?",
    a: "It is free during the pilot — that is the honest phrasing, and we are not going to shorten it to 'free'. We do intend to charge one day. Right now there is not even a way to take your money: the top-up feature is not built. You could not pay us today if you wanted to.",
  },
  {
    q: "When do you start charging, and how much?",
    a: "We have not set a public rate, because we have not finished working out what is fair — and we would rather say nothing than publish a number we have to walk back. What we will commit to: it will be a share of a sale you actually won, never a subscription and never a charge per lead. You will see the exact rate before it ever applies to you.",
  },
  {
    q: "Is this another lead-gen scheme where I pay for leads that go nowhere?",
    a: "You are never charged for being shown a request, and never charged for bidding. That is the part that makes those schemes painful, and it is not how this works. The eventual fee is tied to a deal you won, not to a lead you were shown.",
  },
  {
    q: "What if I win and the customer never turns up?",
    a: "During the pilot it costs you nothing, because nothing is being charged at all. For when billing does start, we have built a window for the customer to report that they did not buy, which credits the fee back — but we are not going to market that as a live guarantee while it has no money moving through it.",
  },
  {
    q: "Can other shops see my price and undercut me?",
    a: "No. Bidding is blind. You cannot see other shops' bids and they cannot see yours — only the customer sees the list. You are pricing against your own margin, not against a number ticking down on a screen.",
  },
  {
    q: "Will bidding force me into a race to the bottom?",
    a: "It is a fair worry, and worth being straight about: competing on price is what this is. What it does not do is oblige you. You choose which requests are worth bidding on and what number you are comfortable with, and you can ignore the rest. Nothing penalises you for not bidding.",
  },
  {
    q: "What do I need to sign up?",
    a: "A phone number to verify by OTP, your shop name, your address on a map, and what you sell. No GST number required, no documents, no field visit. You can be taking requests the same day.",
  },
  {
    q: "Do I need special equipment to confirm a sale?",
    a: "No. The customer shows a QR code on their phone and you scan it with your phone's camera in the browser. Nothing to buy, nothing to install.",
  },
];

export function Faq() {
  const [tab, setTab] = useState<"customer" | "shop">("customer");
  const list = tab === "customer" ? CUSTOMER_FAQ : SHOP_FAQ;

  return (
    <Section id="faq" className="bg-white">
      <div className="max-w-2xl">
        <Eyebrow>Questions</Eyebrow>
        <Heading className="mt-3">The things people actually ask</Heading>
      </div>

      <div
        role="tablist"
        aria-label="Choose your audience"
        className="mt-8 inline-flex rounded-full border border-ink-200 bg-ink-100 p-1"
      >
        {(
          [
            ["customer", "I want to buy"],
            ["shop", "I run a shop"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8 max-w-3xl divide-y divide-ink-200 border-t border-ink-200">
        {list.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left">
              <span className="font-display text-lg font-semibold text-ink-900">{item.q}</span>
              <span
                aria-hidden
                className="mt-1 shrink-0 text-ink-400 transition group-open:rotate-45"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-600">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
