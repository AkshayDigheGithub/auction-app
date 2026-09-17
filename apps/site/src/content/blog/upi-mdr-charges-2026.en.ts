import type { Translation } from "@/lib/blog";

/*
 * Every number here comes from the Department of Financial Services FAQ
 * "Merchant Discount Rate (MDR) on Select UPI (P2M) Transactions" dated
 * 15 September 2026, and the NPCI circular of the same date.
 *
 * Two things are deliberately NOT stated as fact, because that FAQ does not
 * state them and news coverage of it disagreed: the GST treatment of the MDR,
 * and how the 0.4% is split between the issuer, the payer app and the acquirer.
 * Both are written as open questions. This post will be read by people who are
 * about to make a pricing decision, and a confident wrong number here is worse
 * than an admitted gap.
 *
 * Also absent: our own future commission rate. The homepage FAQ commits to
 * saying nothing until the rate is final — publishing a figure here would
 * contradict it on our own domain.
 */
export const upiMdr2026En: Translation = {
  title: "UPI MDR 2026: what shops pay from 15 October",
  description:
    "From 15 October 2026, UPI payments above ₹2,000 carry a 0.4% MDR capped at ₹300. Who pays it, who stays exempt, and what it costs on a ₹45,000 sale.",
  standfirst:
    "For six years, taking a UPI payment cost a shop nothing at all. That changes on 15 October 2026 — but not for everyone, and not on every sale. Here is the version with the numbers in it.",
  keywords: [
    "UPI MDR",
    "UPI charges 2026",
    "MDR on UPI transactions",
    "UPI charges above 2000",
    "0.4% MDR UPI",
    "UPI charges for shop owners",
    "P2PM zero MDR",
    "merchant discount rate India",
  ],
  ogHighlight: { value: "0.4%", label: "on UPI payments above ₹2,000" },

  intro: [
    {
      kind: "p",
      text: "Every few months a message does the rounds saying UPI is about to start charging. It has always been wrong. This time it is not.",
    },
    {
      kind: "p",
      text: "On 15 September 2026, NPCI issued a circular and the Department of Financial Services published a [detailed FAQ](https://financialservices.gov.in/sites/default/files/2026-09/FAQs---Merchant-Discount-Rate--MDR--on-Select-UPI--P2M--Transactions_0.pdf) alongside it. Together they introduce a **Merchant Discount Rate of 0.4% on person-to-merchant UPI payments above ₹2,000**, capped at ₹300 a transaction, from **15 October 2026**.",
    },
    {
      kind: "p",
      text: "Customers pay nothing — that part of the forward is still wrong. Small merchants are carved out entirely. But if you sell phones, laptops or appliances, almost every sale you make is above ₹2,000, so this is worth twenty minutes of your attention rather than a forwarded rumour.",
    },
    {
      kind: "stats",
      items: [
        { value: "0.4%", label: "on UPI payments above ₹2,000" },
        { value: "₹300", label: "maximum, however large the sale" },
        { value: "₹2,000", label: "at or below this, still free" },
        { value: "15 Oct", label: "the day it starts" },
      ],
    },
  ],

  sections: [
    {
      id: "what-is-mdr",
      heading: "What MDR is, and why it is arriving now",
      blocks: [
        {
          kind: "p",
          text: "MDR — Merchant Discount Rate — is the fee a shop pays to accept a digital payment. It comes out of your settlement, not off the customer's bill. Sell something for ₹10,000 at 0.4% and ₹9,960 reaches your account.",
        },
        {
          kind: "p",
          text: "It is not one company's profit. It pays for the rails underneath the payment: the servers, the bandwidth, the fraud checks, the settlement between two banks, the support desk that answers when a payment goes missing.",
        },
        {
          kind: "p",
          text: "The government's reasoning is set out plainly in the FAQ. Running UPI costs the industry roughly **₹20,000 crore a year**. The annual subsidy that paid for zero-MDR was designed as bridge funding, not a permanent arrangement. In August 2026 alone, UPI handled **2,451 crore transactions worth ₹29.9 lakh crore**. The argument is that a system operating at that scale needs its own revenue rather than an annual line in the budget, and that the money stays inside the payments ecosystem — infrastructure, cybersecurity, fraud detection, customer service.",
        },
        {
          kind: "p",
          text: "You can agree with that or not. Either way it starts on 15 October, so the useful question is what it costs you.",
        },
      ],
    },

    {
      id: "the-numbers",
      heading: "The numbers, in one place",
      blocks: [
        {
          kind: "table",
          head: ["", ""],
          rows: [
            ["Rate", "**0.4%** of the payment"],
            ["Applies to", "Merchant payments **above ₹2,000**"],
            ["Maximum", "**₹300** — for payments of ₹75,000 and above"],
            ["Up to ₹2,000", "Nothing. Unchanged."],
            ["Money between people", "Nothing. Unchanged."],
            ["Who pays", "The shop, to its bank"],
            ["From", "**15 October 2026**"],
          ],
        },
        {
          kind: "p",
          text: "Once a payment crosses ₹2,000, the 0.4% applies to **the whole amount**, not just the part above ₹2,000. That is why the ₹300 ceiling lands exactly at ₹75,000.",
        },
        {
          kind: "p",
          text: "These are the worked examples from the government's own FAQ:",
        },
        {
          kind: "table",
          head: ["Payment received", "Rate applied", "What you pay"],
          align: ["right", "right", "right"],
          rows: [
            ["₹2,000", "—", "**₹0**"],
            ["₹3,000", "0.40%", "**₹12**"],
            ["₹50,000", "0.40%", "**₹200**"],
            ["₹75,000 and above", "Fixed ₹300", "**₹300**"],
          ],
          note: "Source: [DFS FAQ on MDR on Select UPI (P2M) Transactions](https://financialservices.gov.in/sites/default/files/2026-09/FAQs---Merchant-Discount-Rate--MDR--on-Select-UPI--P2M--Transactions_0.pdf), 15 September 2026, Q35.",
        },
        {
          kind: "p",
          text: "For the sales an electronics shop actually makes: **₹18,000 costs you ₹72. ₹45,000 costs you ₹180. ₹1,40,000 costs you ₹300.** A shop closing twenty deals a month at an average of ₹35,000 — ₹7 lakh of UPI turnover — is looking at about **₹2,800 a month**.",
        },
        {
          kind: "callout",
          tone: "brand",
          title: "The cap works in your favour on big sales",
          text: "On a ₹1.4 lakh laptop, ₹300 is an effective rate of 0.21%. The higher your average sale, the lower the percentage you actually pay. The FAQ spells this out: a ₹1,00,000 payment is charged ₹300, not ₹400.",
        },
        {
          kind: "p",
          text: "One gap worth naming: the FAQ says nothing about GST on the MDR. Ordinary treatment of a service fee would suggest 18%, recoverable as input tax credit if you are registered — but that is not in the document, and coverage of it has not been consistent. Ask your CA or your bank rather than taking anyone's word for it, this post included.",
        },
      ],
    },

    {
      id: "who-pays",
      heading: "Who actually pays — and who does not",
      blocks: [
        {
          kind: "callout",
          tone: "brand",
          title: "The one line to take away",
          text: "MDR is decided by **what kind of merchant account you have**, not by the size of the sale. A small merchant who receives ₹40,000 in one payment still pays nothing.",
        },
        {
          kind: "p",
          text: "This is the part most of the coverage got muddled, and it is the part that decides whether October costs you anything at all.",
        },
        {
          kind: "p",
          text: "NPCI runs a category called **P2PM** — Person-to-Person-Merchant. It covers small vendors who receive **up to ₹1 lakh a month** through a UPI QR straight into their own account. For them MDR is zero, mandatorily, whatever the size of an individual payment. The ₹2,000 threshold only starts to matter once you are in the standard P2M category.",
        },
        {
          kind: "p",
          text: "How you move between them: your acquiring bank runs a velocity check on what comes in. If your inward UPI credits **exceed ₹1 lakh a month for three consecutive months**, you are formally moved into P2M, and MDR begins to apply.",
        },
        {
          kind: "p",
          text: "For a mobile shop, ₹1 lakh is two or three handsets. Most of you will cross that line and stay across it — which is exactly why it is worth ringing your bank and finding out which side of it you are on today.",
        },
        {
          kind: "p",
          text: "Two more things worth knowing about the small-merchant side:",
        },
        {
          kind: "list",
          items: [
            "**You do not need GST registration to qualify.** Zero MDR under P2PM is decided by the monthly threshold and your account type, nothing else. The FAQ is explicit that tax registration is not a condition.",
            "**Nothing about your setup has to change.** Existing QR stands, soundboxes and registrations keep working exactly as they do now. No branch visit, no re-registration, no new sticker. If someone offers to sell you an MDR-ready QR code, they are selling you nothing.",
          ],
        },
        {
          kind: "p",
          text: "Also outside the 0.4% entirely: money sent between people — family, friends, splitting a bill, moving money between your own accounts — which stays free for both sides, at any amount. And UPI AutoPay and mandates: utility autopays, OTT subscriptions, recurring investments carry no prescribed MDR.",
        },
        {
          kind: "p",
          text: "UPI apps are separately barred from charging you or your customer a platform fee on a UPI payment.",
        },
      ],
    },

    {
      id: "other-rates",
      heading: "The categories that pay something other than 0.4%",
      blocks: [
        {
          kind: "p",
          text: "Not every business pays the standard rate. The framework carves out sectors where a percentage fee would be punishing, either because margins are thin or because the payment is an essential service.",
        },
        {
          kind: "table",
          head: ["What is being paid for", "Above ₹2,000"],
          rows: [
            ["Railways, telecom, insurance, fuel", "**Flat ₹5** per payment"],
            ["Electricity, water, piped gas", "**Flat ₹5** per payment"],
            ["Mutual funds, brokers, securities", "**0.02%**, maximum ₹300"],
            ["School and college fees", "Flat or capped — the FAQ names no figure"],
            ["Everything else, including electronics retail", "**0.4%**, maximum ₹300"],
          ],
        },
        {
          kind: "p",
          text: "A phone shop sits in none of the concessional buckets. It is the standard 0.4%.",
        },
        {
          kind: "p",
          text: "There is also a **dedicated fund** being set up out of MDR revenue, to push digital payment infrastructure into Tier 3 to Tier 6 centres, the North East, Jammu and Kashmir and Ladakh, and to help acquiring banks onboard small merchants. Its detailed framework is to be finalised with the RBI within three months of the announcement — so the shape of it is not knowable yet.",
        },
        {
          kind: "callout",
          tone: "warn",
          title: "Credit on UPI is a different animal",
          text: "RuPay credit cards linked to UPI, and pre-sanctioned credit lines, sit outside this framework. They are credit products and follow standard credit card rules — meaning credit card economics, not 0.4%. Your settlement statement will separate them. The person at your counter will not notice any difference.",
        },
      ],
    },

    {
      id: "no-surcharge",
      heading: "You cannot add it to the customer's bill",
      blocks: [
        {
          kind: "callout",
          tone: "warn",
          title: "This is the rule most likely to cause trouble in week one",
          text: "Passing MDR on to the customer is explicitly prohibited. If a phone is priced ₹45,000, the customer pays ₹45,000 — not ₹45,180. No UPI surcharge at the counter, and no one price for cash and a higher one for UPI.",
        },
        {
          kind: "p",
          text: "The FAQ's own words are that the framework ensures consumers pay only the posted price. Its stated expectation is that shops absorb this the way they already absorb card charges — offset by footfall, by larger average sales, and by not having to handle, count and bank cash.",
        },
        {
          kind: "p",
          text: "If you need to recover it, recover it in your pricing. Recovering it at the counter is both against the rules and the fastest way to lose the customer you just won.",
        },
      ],
    },

    {
      id: "vs-cards",
      heading: "It is still the cheapest way to take a large payment",
      blocks: [
        {
          kind: "p",
          text: "A new charge always lands badly. It is worth putting next to the alternatives before deciding how you feel about it.",
        },
        {
          kind: "table",
          head: ["How the customer pays", "What it costs you"],
          rows: [
            ["UPI, up to ₹2,000", "**Nothing**"],
            ["UPI, above ₹2,000, from 15 Oct", "**0.4%**, never more than ₹300"],
            ["Debit card", "Up to **0.90%**"],
            ["Credit card", "Usually **1.5% to 2.5%** — with no cap"],
            ["Cash", "No fee — plus counting, banking, theft risk, no record"],
          ],
          note: "The card figures are the ones quoted in the government FAQ itself, in its comparison of UPI against other instruments.",
        },
        {
          kind: "p",
          text: "Run it on a real sale. A ₹70,000 phone costs you **₹300 on UPI**, against roughly **₹1,050 to ₹1,750 on a credit card**. No card scheme offers a per-transaction ceiling at all. UPI remains, by a wide margin, the cheapest way to accept a large payment — it is simply no longer free.",
        },
      ],
    },

    {
      id: "before-october",
      heading: "What to do before 15 October",
      blocks: [
        {
          kind: "list",
          ordered: true,
          items: [
            "**Ring your bank and ask whether you are P2PM or P2M.** One question, one answer, and it settles whether any of this applies to you. If you are anywhere near ₹1 lakh a month, ask what your last three months looked like.",
            "**Do not buy anything.** Your existing QR, soundbox and registration all keep working. There is nothing to upgrade and nobody to pay.",
            "**Read your settlement statement on 16 October.** Check three things: nothing deducted at or below ₹2,000, 0.4% above it, and never more than ₹300 on a single payment. Week-one errors are likely somewhere in the chain — they are easy to fix while they are small and nearly impossible to unpick six months later.",
            "**Ask your CA about GST on the fee.** The FAQ does not cover it. If input tax credit is available to you, you want to be claiming it from the first week, not backdating it.",
            "**Decide once how you will absorb it.** 0.4% of your monthly UPI turnover is a number you can work out this week. Put it into your margin or into your pricing deliberately — not improvised at the counter in front of a customer.",
            "**Check rumours at the source.** The government's own advice is to rely on PIB, the RBI or NPCI, and not to forward unverified messages. There will be a great many of those this month, and some of them will be aimed at selling you something.",
          ],
        },
      ],
    },

    {
      id: "mivikto",
      heading: "What this means if you sell through mivikto.store",
      blocks: [
        {
          kind: "p",
          text: "Straight answers, since this changes what our shops pay:",
        },
        {
          kind: "list",
          items: [
            "**The sale does not run through us.** The customer walks into your shop and pays you directly — UPI, card, cash, EMI, whatever you both prefer. We never hold the money. MDR on that payment is between you and your bank, and we add nothing on top of it.",
            "**Customers are never charged by us.** Posting a request, receiving bids, locking a deal: free, and staying free.",
            "**Shops are free during the pilot.** That is the exact phrasing, and we are not going to shorten it to free. There is not even a way to take your money today — the top-up feature is not built.",
            "**When we do charge, it will be a share of a sale you actually won** — never a subscription, never a fee per lead, and never a cut of the payment itself. You will see the rate before it ever applies to you.",
          ],
        },
        {
          kind: "p",
          text: "One is the cost of getting paid. The other is the cost of the customer walking through your door in the first place. Worth judging separately.",
        },
      ],
    },

    {
      id: "faq",
      heading: "Quick answers",
      blocks: [
        {
          kind: "faq",
          items: [
            {
              q: "Will customers be charged for paying by UPI?",
              a: "No. Consumers pay nothing — person-to-person, person-to-merchant, QR scans, any amount, with no monthly quota on free transactions. UPI apps are also barred from charging a platform fee.",
            },
            {
              q: "Does MDR apply to my ₹500 sales?",
              a: "No. Payments up to ₹2,000 are free, and the government puts those at more than 95% of all UPI merchant transactions by volume.",
            },
            {
              q: "I receive under ₹1 lakh a month. Do I pay anything?",
              a: "No. You are in the P2PM category, which is zero MDR — even on a single ₹40,000 payment. You only move into the charged category if your inward UPI credits stay above ₹1 lakh a month for three consecutive months.",
            },
            {
              q: "Is the 0.4% only charged on the amount above ₹2,000?",
              a: "No. Once a payment crosses ₹2,000, the 0.4% applies to the full amount. On ₹3,000 that is ₹12, not ₹4.",
            },
            {
              q: "What is the most I can be charged on one payment?",
              a: "₹300. The cap applies to every payment of ₹75,000 and above, so a ₹1,00,000 sale costs ₹300, not ₹400.",
            },
            {
              q: "Do I need a new QR code or soundbox?",
              a: "No. Every QR code and soundbox currently in use keeps working, with no re-registration and no branch visit. Nobody needs to sell you a new one.",
            },
            {
              q: "Can I charge the customer extra to cover it?",
              a: "No. Passing MDR on to customers is explicitly prohibited, and that includes quoting a lower price for cash than for UPI.",
            },
            {
              q: "Will prices in shops go up because of this?",
              a: "Not because of this. Merchants cannot pass the fee on, and the government's stated expectation is that shops absorb it as an operating cost, as they already do with card charges.",
            },
            {
              q: "What about paying by credit card through a UPI app?",
              a: "That is a credit product and sits outside this framework — it follows standard credit card rules, which are considerably more expensive than 0.4%.",
            },
            {
              q: "Should I just go back to taking cash?",
              a: "You can, but weigh it properly: ₹300 on a ₹70,000 sale against counting it, banking it, the risk of holding it, and a customer who does not carry ₹70,000 in notes.",
            },
          ],
        },
      ],
    },
  ],

  sources: [
    {
      label: "Merchant Discount Rate (MDR) on Select UPI (P2M) Transactions — FAQ",
      url: "https://financialservices.gov.in/sites/default/files/2026-09/FAQs---Merchant-Discount-Rate--MDR--on-Select-UPI--P2M--Transactions_0.pdf",
      note:
        "Department of Financial Services, Ministry of Finance, 15 September 2026. Every rate, threshold and worked example on this page comes from this document.",
    },
    {
      label: "Department of Financial Services",
      url: "https://financialservices.gov.in",
      note: "Where that FAQ is published, and where a revision to it would appear first.",
    },
    {
      label: "NPCI",
      url: "https://www.npci.org.in",
      note:
        "Issued the circular of 15 September 2026. Rates, category caps and the P2PM threshold are set here and can be changed here.",
    },
    {
      label: "Press Information Bureau",
      url: "https://www.pib.gov.in",
      note:
        "Official announcements. The FAQ's own advice is to check here, the RBI or NPCI before believing a forwarded message about UPI charges.",
    },
  ],

  // The attribution lives in `sources` above, so this carries only the caveat.
  disclaimer:
    "Operational parameters, fee distribution and category caps are set by the UPI and Services Steering Committee headed by NPCI, and can be revised — check the current official notification before you rely on these figures. This is general information, not tax or legal advice. For your own GST position or your merchant classification, speak to your CA and your acquiring bank.",
};
