# Backlog: Monetization v2 — Prepaid Wallet, Categories & Admin

**Status:** ✅ **BUILT, running in shadow mode.** No shop is charged.
Collection (wallet top-ups) is deliberately not implemented — see §0.3.
**Supersedes:** parts of spec §5 (Monetization) and epic AUC-6 (Payments & Commission)
**Related:** `mvp-spec-hyperlocal-bid-app_1.md` §5, §9, §10
**Created:** 2026-08-26
**Parked:** 2026-08-26
**Jira:** epics AUC-44 / AUC-45 / AUC-46 · stories AUC-47…AUC-73 · decisions AUC-74, AUC-75
· board: https://cultagrix.atlassian.net/browse/AUC-44
· all tickets carry the label `monetization-v2`

---

## 0. Status (2026-08-26)

Everything below is **implemented except payment collection**, and ships switched
off: `BILLING_MODE` defaults to `shadow`, so fees are computed and recorded on every
locked deal while **no shop is charged, gated, or has its free trial consumed**.

The pilot still runs **free for all shops**. What changed is that it now produces
real pricing data instead of nothing.

### 0.3 What is built vs. deliberately not

| | |
|---|---|
| ✅ Built | Wallet balance + append-only ledger, per-category rates (admin-editable), fee charged at **deal lock**, balance gating, 3-free-deals trial, 72-hour customer reversals with auto-approval, category-aware matching, shop + product categories, admin dashboard (wallet ops, rate editor, revenue v2, leakage, reports queue, audit log, search/filter/CSV) |
| ⛔ Not built, on purpose | **Wallet top-ups.** `POST /wallet/me/recharge` returns 501 with an explanation. Taking money needs the GST position (AUC-74) and the refund policy (AUC-75) settled first. Admin can credit a wallet manually in the meantime, which exercises every downstream path. |

### 0.4 Switching billing on later

1. Settle AUC-74 (GST) and AUC-75 (refund policy).
2. Implement the Razorpay order + **webhook** in place of the 501 stub, and call
   `WalletService.credit`. The webhook — not the client callback — must be what
   credits the wallet, and it must be idempotent.
3. Set `BILLING_MODE=live`.

Step 3 alone turns on charging, gating and trial consumption. Nothing else changes.

Reasons:

- No GST registration exists today. Collecting money for a service raises registration
  questions that must be answered by a CA first — see §7.6. Not charging means the
  question does not arise yet.
- Wallet refund policy is undecided — and moot, because with no wallet there is no
  balance to refund.
- At zero shops and zero deals, 0.6% of nothing is ₹0. The wallet epic
  (AUC-48/49/50/53) is multiple weeks of work returning no revenue and no learning at
  pilot scale.
- The MVP risk is "nobody uses this," not "we are not charging."

### What is still done during the free pilot

Three things are cheap now and expensive to retrofit. These are **not** parked:

1. **Shadow billing (see §0.1).** Charge ₹0, but record what the fee *would* have been
   on every locked deal. After a month there is real data to price against, instead of
   another round of estimates.
2. **Say "free during pilot", never "free".** Every shop conversation, onboarding
   screen and WhatsApp message states that pricing starts after the pilot. Costs
   nothing now; onboarding shops on "free" and charging later burns the relationship.
3. **Keep this document current.** It is the plan for month two, not a discarded draft.

### 0.1 Shadow billing — the only build item

**Jira: AUC-47** — the one ticket in this batch not labelled `parked`.

Smallest possible version, hours not weeks:

- On `lockDeal()`, compute and store what the fee would have been at 0.6% capped ₹300.
- Store it on the deal. Charge nothing, gate nothing, notify no one.
- Surface one number in admin: **"would-be revenue this month."**

No wallet, no ledger, no Razorpay, no balance gating. Everything else in this document
stays parked.

### 0.2 What the pilot month must answer

Without these numbers, month two is another guess:

| Question | Why it decides the price |
|---|---|
| Shops onboarded, and how many actually bid | Supply density — below ~10 active per area there is no auction |
| Requests per week | Demand volume |
| **Bids per request** | Under 2, this is not a reverse auction and shops will not pay for it |
| Lock rate (requests → locked deal) | How often a request becomes a billable event |
| Lock-to-confirm ratio | Whether deals are real, and the size of the leakage problem |
| **Average deal value** | Directly sets the rate — all §2.1 numbers assume ₹30k electronics |
| Would-be revenue (shadow billing) | Whether 0.6%/₹300 is worth collecting at all |

**Decision gate at day 30:** if would-be revenue is under roughly ₹5,000/month, do not
build the wallet — the collection machinery costs more than it returns. Grow supply
first and revisit at day 60.

---

## 1. Why this exists

The current model bills commission when the **shop owner scans the QR**
(`apps/api/src/deals/deals.service.ts` → `scanDeal()` → `triggerCommission()`).

Three problems with that:

1. **The payer controls the trigger.** The shop owner pays the fee *and* presses the
   button that creates the fee. A shop that simply never scans pays nothing.
   Estimated leakage: **30–40% of deals.**
2. **Nothing actually collects money.** `RazorpayPaymentProvider` creates a Razorpay
   *order* — a request to pay. No one pays it, so `commissionStatus` stays `pending`
   forever. There is no collection mechanism in the system today.
3. **Money never flows through the platform.** The customer pays the shop in-store by
   cash or direct UPI. We cannot split or deduct from a payment we never touch, so
   Razorpay Route does not solve this.

**The fix, in one line:** stop billing on an event the shop controls, stop trying to
collect after the fact. Bill at **deal lock** (a customer action, inside our app) and
deduct from a **prepaid wallet** the shop has already funded.

---

## 2. Decisions locked by this document

These were open in spec §10. Treat them as decided unless the founder reverses them.

| Decision | Value |
|---|---|
| Billing trigger | **Deal lock** (`lockDeal()`), not QR scan |
| Collection method | **Prepaid wallet**, deducted automatically |
| Commission rate | **Per shop category** (table below), was flat 2% |
| Per-deal cap | **Yes** — category-specific, ₹300 for electronics |
| Per-deal floor | **₹20** (grocery uses a flat fee instead) |
| Free trial | **First 3 won deals free**, no calendar/expiry |
| Customer pricing | **Free forever** — unchanged |
| Reversal window | **72 hours**, credited back to wallet |
| QR scan role | **Receipt + trust signal only** — no longer a billing trigger |

### 2.1 Commission rates by shop category

Rule of thumb applied: platform takes **~20% of the shop's typical gross margin**.

| Shop category | Typical shop margin | Rate | Per-deal cap | Floor |
|---|---|---|---|---|
| `mobile_electronics` | 3–6% | 0.60% | ₹300 | ₹20 |
| `computers` | 4–8% | 0.60% | ₹300 | ₹20 |
| `appliances` | 5–10% | 0.80% | ₹300 | ₹20 |
| `hardware` | 10–15% | 1.00% | ₹300 | ₹20 |
| `auto_parts` | 15–25% | 1.25% | ₹300 | ₹20 |
| `furniture` | 20–40% | 1.50% | ₹400 | ₹20 |
| `apparel` | 30–50% | 2.00% | ₹300 | ₹20 |
| `jewellery` | 5–10% | 0.30% | ₹500 | ₹20 |
| `grocery` | 3–8% on small baskets | flat ₹10 | — | — |

Rates must live in **configuration/database, not a constant**. The current
`const COMMISSION_RATE = 0.02` in `deals.service.ts:13` is a hardcoded placeholder and
must not survive this work.

### 2.2 Recharge slabs

| Shop pays | Credit received | Approx. deals covered (electronics) |
|---|---|---|
| ₹500 | ₹500 | ~2 |
| ₹1,000 | ₹1,100 | ~3–4 |
| ₹2,500 | ₹3,000 | ~10 |

Collect recharges over **UPI** — near-zero MDR under RBI Zero MDR, so the bonus is
partly funded by the card fee we avoid.

### 2.3 Expected economics

Average billable event (electronics, 0.6% capped ₹300): **~₹180 per won deal.**

| Active shops | Wins/shop/month | Monthly revenue |
|---|---|---|
| 20 | 3 | ₹10,800 |
| 50 | 3 | ₹27,000 |
| 100 | 4 | ₹72,000 |
| 200 | 4 | ₹1,44,000 |

Against spec §8 running cost of ₹2,500–12,000/month, break-even is **14–67 wins/month
≈ 5–20 active shops**. Unlike the old model, effectively 100% of this is collectible.

---

## 3. Epic AUC-44 — Prepaid Wallet & Lock-Based Billing

Owner agent: `payments`, with `backend-api` for schema.

---

### AUC-48 — Wallet balance and ledger

**Priority:** P0 — blocks everything else in this epic.

Shops need a stored balance and a full audit trail of every movement.

**Acceptance criteria**
- `Shop` gains a balance field (paise/integer, never float).
- New `WalletTransaction` table: id, shopId, type, amount, balanceAfter, dealId (nullable),
  reason, createdAt, createdByUserId (nullable, for manual admin adjustments).
- Transaction types: `recharge`, `deal_fee`, `reversal`, `bonus`, `admin_credit`,
  `admin_debit`, `trial_waiver`.
- Every balance change writes a ledger row in the **same database transaction** as the
  balance update. No balance change may exist without a ledger row.
- Balance can never go negative — attempts fail loudly, not silently.
- `balanceAfter` is recorded on every row so the ledger is self-verifying.

**Notes:** store money as integer paise throughout. `Deal.finalPrice` is currently
`Decimal(10,2)`; do not mix representations.

---

### AUC-49 — Wallet recharge via Razorpay UPI

**Priority:** P0
**Depends on:** AUC-48

**Acceptance criteria**
- Shop owner sees balance and a "Recharge" action in the PWA.
- Three slabs per §2.2, plus a custom amount (minimum ₹500).
- Razorpay checkout completes the payment; UPI is the default and preferred method.
- **A Razorpay webhook — not the client callback — credits the wallet.** The existing
  order-creation-only flow in `razorpay-payment.provider.ts` is insufficient and is the
  root cause of `commissionStatus` never leaving `pending`.
- Webhook handler is idempotent — a replayed event must not double-credit.
- Webhook signature is verified; unverified payloads are rejected and logged.
- Bonus credit is applied as a separate `bonus` ledger row, so paid vs. gifted money
  is always distinguishable in reporting.
- Failed/abandoned payments leave the balance untouched and are visible to the shop.

**Risk:** this is the highest-risk story in the epic — money in, with no reconciliation
path today. Do not ship without webhook idempotency tests.

---

### AUC-50 — Move billing trigger to deal lock

**Priority:** P0
**Depends on:** AUC-48, AUC-51

Move the fee from `scanDeal()` to `lockDeal()` (`deals.service.ts:26`).

**Acceptance criteria**
- When a customer locks a bid, the winning shop's wallet is debited by the computed fee.
- Debit and deal creation happen in one atomic transaction — a failed debit must not
  leave an orphan deal, and a created deal must not leave an uncharged shop.
- `Deal` records the fee charged, the rate applied, and the category it was applied under
  — **snapshot the values at charge time**, so later rate changes never rewrite history.
- `scanDeal()` no longer calls `triggerCommission()`.
- Existing `commissionAmount` / `commissionStatus` fields are either reused with clear
  new semantics or migrated; decide explicitly, do not leave two overlapping concepts.
- Deals locked during the free trial (AUC-52) are recorded with a zero fee and a
  `trial_waiver` ledger row, not skipped silently.

---

### AUC-51 — Per-category commission configuration

**Priority:** P0
**Depends on:** AUC-57 (categories must exist first)

**Acceptance criteria**
- Rate, cap and floor are stored per shop category in the database, seeded from §2.1.
- A flat-fee mode exists for grocery (fee is a fixed amount, not a percentage).
- Fee calculation is a single pure, unit-tested function:
  `fee = clamp(price * rate, floor, cap)` — or the flat fee where configured.
- `const COMMISSION_RATE = 0.02` is deleted.
- Changing a rate affects only future deals. Historical deals keep their snapshot.
- Rate changes are audit-logged with who changed it and when.

---

### AUC-52 — Free trial: first 3 won deals

**Priority:** P1
**Depends on:** AUC-50

**Acceptance criteria**
- A counter on `Shop` tracks free deals consumed.
- The first 3 locked deals for a shop are charged ₹0 and logged as `trial_waiver`.
- No calendar logic, no expiry job, no dunning — the counter is the whole mechanism.
- A shop still in trial can receive leads with a zero balance.
- After the 3rd free deal, the shop is prompted to recharge before further leads.
- Reversed trial deals (AUC-54) do **not** consume a free deal.

**Rationale:** a time-based trial punishes shops in slow areas during cold start and
requires expiry infrastructure. A count-based trial self-adjusts to demand and needs
one integer.

---

### AUC-53 — Balance gating on lead delivery

**Priority:** P0
**Depends on:** AUC-48, AUC-51

This is what makes the model self-collecting. No balance, no leads.

**Acceptance criteria**
- A shop is excluded from matching when its balance is below the maximum fee it could
  incur for its category — checked at match time, not bid time.
- Shops in trial (AUC-52) are exempt from this check.
- An excluded shop sees a clear reason in the PWA, not silence.
- A shop cannot place a bid it could not afford to have locked; the failure message is
  explicit and points to recharge.
- Exclusion is logged so admin can distinguish "no shops in radius" from
  "all shops out of balance" — these look identical to a customer and have opposite fixes.

---

### AUC-54 — 72-hour customer reversal

**Priority:** P1
**Depends on:** AUC-50

**Acceptance criteria**
- Customer can report "did not buy" / "shop unavailable" within 72 hours of locking.
- The fee is credited back to the shop wallet as a `reversal` ledger row — never a bank
  refund, which would create reconciliation and dispute overhead for ₹300.
- The window is configurable, defaulting to 72 hours.
- Confirmed deals (QR scanned) cannot be reversed by the customer.
- Reversal rate is tracked **per customer** — a customer reversing everything is either
  a bad actor or a broken funnel; both need to be visible.
- Reversal rate is tracked **per shop** — a shop with many reversals may be quoting
  prices it does not honour.

---

### AUC-55 — Low-balance notifications

**Priority:** P2
**Depends on:** AUC-48, AUC-53

**Acceptance criteria**
- Web Push when balance falls below ~2 deals' worth for the shop's category.
- Second notification when the shop becomes ineligible for matching.
- Message states the business consequence plainly: "you are no longer receiving
  customers" — not a generic balance figure.
- Rate-limited: at most one of each per shop per 24 hours.
- SMS fallback via MSG91 when push is not subscribed.

---

### AUC-56 — Repurpose QR as receipt and trust signal

**Priority:** P2
**Depends on:** AUC-50

The QR flow stays, but its job changes entirely.

**Acceptance criteria**
- QR scan no longer triggers any charge.
- Confirmed deals produce an in-app receipt for the customer: shop, product, final
  price, date.
- Customer can rate the shop **only** on a confirmed deal.
- Optional but recommended: the bid price is presented to the customer as guaranteed
  only when confirmed in-app. This makes the customer ask the shop for the QR, which
  is the cheapest available enforcement mechanism.
- Lock-to-confirm ratio is computed per shop and exposed to admin (AUC-68). It is now
  a **shop-quality metric**, not a revenue dependency.

---

## 4. Epic AUC-45 — Shop & Product Categories

Owner agents: `backend-api` (schema), `frontend-pwa` (UI), `geo-matching` (matching).

Currently `ShopCategory` has exactly one value, `mobile_electronics`
(`apps/api/prisma/schema.prisma:21`), and there is no product-category concept at all.
Per-category pricing (AUC-51) cannot exist without this epic.

---

### AUC-57 — Expand shop categories

**Priority:** P0 — blocks AUC-51.

**Acceptance criteria**
- `ShopCategory` gains: `computers`, `appliances`, `hardware`, `auto_parts`,
  `furniture`, `apparel`, `jewellery`, `grocery`.
- Migration keeps every existing shop on `mobile_electronics` — no data loss, no
  re-onboarding.
- Each category carries a display name and an icon for UI use.
- Categories can be deactivated without deleting them (a deactivated category keeps
  existing shops working but accepts no new signups).

**Scope flag:** spec §9 lists multi-category as **out of MVP scope**. This is a
deliberate override, driven by per-category pricing. Founder sign-off required.
If the pilot stays electronics-only, ship the enum and pricing table anyway and simply
do not market the other categories — the schema cost is near zero, the retrofit cost is not.

---

### AUC-58 — Product category taxonomy

**Priority:** P1
**Depends on:** AUC-57

Shop category ≠ product category. A general electronics shop sells phones, laptops and
headphones; matching and pricing need the finer grain.

**Acceptance criteria**
- New `ProductCategory` table (not an enum — this list will change often and should be
  editable by admin without a deploy).
- Two levels: parent (e.g. "Mobile & Electronics") and child (e.g. "Smartphones",
  "Laptops", "Headphones", "Smartwatches").
- Each product category maps to one or more shop categories.
- `Request` gains a nullable product category reference.
- Nullable and backward compatible — existing requests keep working untagged.
- Seed data covers the pilot category thoroughly and other categories minimally.

---

### AUC-59 — Category-aware matching

**Priority:** P1
**Depends on:** AUC-57, AUC-58

**Acceptance criteria**
- Geo-radius matching additionally filters by category — a furniture shop stops getting
  iPhone requests.
- Matching falls back to shop-category level when the request has no product category.
- A request with no category match inside the radius is surfaced to admin rather than
  failing silently.
- Existing PostGIS radius behaviour is unchanged; category is an additional predicate.

**Value:** this directly improves lead quality, which is what shops are now paying for.

---

### AUC-60 — Multi-category shops

**Priority:** P2
**Depends on:** AUC-57

**Acceptance criteria**
- A shop can select a primary category and additional secondary categories.
- Fee is charged at the **rate of the category the request falls under**, not the shop's
  primary — a furniture shop winning an electronics request pays the electronics rate.
- Onboarding UI supports multi-select with the primary clearly designated.
- Admin can edit a shop's categories (AUC-67).

---

### AUC-61 — Category selection in customer request flow

**Priority:** P1
**Depends on:** AUC-58

**Acceptance criteria**
- Customer picks a category when creating a request, with search.
- Optional, never blocking — a customer who just types "iPhone 15" must still be able
  to submit.
- Suggest a category from the typed product name where possible.
- Recently used categories surface first.

---

### AUC-62 — Category in shop onboarding

**Priority:** P1
**Depends on:** AUC-57

**Acceptance criteria**
- Onboarding shows category selection with the **applicable commission rate visible
  before the shop commits**. Pricing transparency at signup is a trust feature, not a
  disclosure chore.
- Rate, cap and free-trial terms are shown in plain language. English only for now —
  localisation is a separate decision, not something to slip in through copy.
- Changing category after onboarding requires admin approval (prevents rate arbitrage
  by self-switching to `jewellery` at 0.3%).

---

## 5. Epic AUC-46 — Admin Dashboard v2

*(Extends MVP epic AUC-8. Kept as a separate epic because AUC-8 is MVP scope and this
batch is parked.)*

Owner agent: `admin-dashboard`.

Today: 5 read-only endpoints and one 172-line page
(`apps/api/src/admin/admin.service.ts`, `apps/web/src/app/admin/page.tsx`).
The wallet model makes admin operationally critical — money now sits in the system.

---

### AUC-63 — Wallet and ledger views

**Priority:** P0
**Depends on:** AUC-48

**Acceptance criteria**
- Shop list gains a balance column, sortable, with low/zero balance highlighted.
- Per-shop ledger view: every transaction with type, amount, running balance, linked deal.
- Platform totals: total float held (money owed as undelivered service), total recharged,
  total consumed, total reversed.
- Filter ledger by type and date range.

**Note:** wallet float is a real liability. If shops hold ₹80,000 in unspent balance,
that is not revenue. Do not let the revenue dashboard imply otherwise.

---

### AUC-64 — Manual wallet adjustment

**Priority:** P0
**Depends on:** AUC-48, AUC-65

Support will need this on day one — failed webhooks, goodwill credits, disputes.

**Acceptance criteria**
- Admin can credit or debit any shop wallet.
- A reason is **mandatory**, free text, minimum length enforced.
- Writes an `admin_credit` / `admin_debit` ledger row with the acting admin's user id.
- Confirmation step showing shop name, current balance, and resulting balance.
- Adjustments above a configurable threshold are flagged in the audit log.

---

### AUC-66 — Commission rate management

**Priority:** P1
**Depends on:** AUC-51

**Acceptance criteria**
- Admin edits rate, cap and floor per category from the UI — no deploy needed.
- A preview showing the fee on sample deal values (₹5,000 / ₹30,000 / ₹70,000) before saving.
- Changes are audit-logged (AUC-65) and take effect on future deals only.
- A guard rail: rates above a sanity threshold (e.g. 5%) require explicit confirmation.

---

### AUC-67 — Shop detail page

**Priority:** P1
**Depends on:** AUC-63

One page with everything about one shop, replacing today's flat list.

**Acceptance criteria**
- Profile, categories, verification status, UPI id, location on a map.
- Wallet balance and recent ledger.
- Bids placed, deals won, deals confirmed, lock-to-confirm ratio.
- Trial status (free deals remaining).
- Actions: verify/unverify, edit categories, adjust wallet, suspend.
- Suspension blocks matching immediately and is reversible.

---

### AUC-68 — Leakage and quality monitoring

**Priority:** P1
**Depends on:** AUC-56

Even though revenue no longer depends on the QR scan, confirm rate is the best signal
of whether deals are real.

**Acceptance criteria**
- Lock-to-confirm ratio per shop over a selectable window, sortable ascending.
- Platform-wide ratio trend over time.
- Highlight shops with high lock volume and low confirm rate.
- Cross-reference reversal rate — high reversals plus low confirms means either a bad
  shop or a broken area, and admin needs to tell those apart.

---

### AUC-69 — Revenue dashboard v2

**Priority:** P1
**Depends on:** AUC-48, AUC-51

Replaces the current single-number `revenueSummary()`.

**Acceptance criteria**
- Fees earned by day / week / month.
- Breakdown by shop category and by product category.
- Recharges collected vs. fees consumed vs. float outstanding — these are three
  different numbers and must never be conflated.
- Trial cost: total value waived under AUC-52, as an acquisition-spend figure.
- Reversals as a separate deduction line.
- Average fee per deal, and active paying shop count.
- Progress against the ₹2,500–12,000/month cost band from spec §8.

---

### AUC-70 — Reversal and dispute queue

**Priority:** P1
**Depends on:** AUC-54

**Acceptance criteria**
- Queue of customer-reported reversals, newest first.
- Each entry shows the deal, shop, customer, amount, and stated reason.
- Admin can approve (credit wallet) or reject with a reason.
- Auto-approval for reversals under a configurable amount, to keep support load sane —
  contesting ₹180 costs more than it recovers.
- Repeat-reverser customers are flagged in the queue.

**Spec note:** §10 lists dispute handling as an unresolved open decision. This story
resolves it for the wallet model specifically.

---

### AUC-72 — Category management

**Priority:** P2
**Depends on:** AUC-58

**Acceptance criteria**
- CRUD for product categories and their shop-category mappings.
- Reorder and activate/deactivate.
- A category in use cannot be hard-deleted, only deactivated.
- Shows how many shops and requests reference each category before any change.

---

### AUC-71 — Search, filtering, pagination, export

**Priority:** P1

Today every list is `take: 200` with no filters. That breaks at pilot scale, let alone
after it.

**Acceptance criteria**
- Server-side pagination on requests, deals, shops and ledger.
- Search shops by name, phone, area. Search requests by product name.
- Filter deals by status, category, date range; requests by status and category.
- CSV export on every list, respecting active filters.
- Existing `take: 200` calls are removed.

---

### AUC-65 — Admin audit log

**Priority:** P0
**Depends on:** nothing — build alongside AUC-64.

Admins can now move money. Every privileged action must be attributable.

**Acceptance criteria**
- Records: actor, action, target entity, before/after values, timestamp, IP.
- Covers wallet adjustments, rate changes, verification, suspension, category edits.
- Read-only in the UI — no admin can edit or delete audit entries.
- Filterable by actor, action type, and date range.

---

### AUC-73 — Trial cohort view

**Priority:** P2
**Depends on:** AUC-52

**Acceptance criteria**
- Shops grouped by trial state: in trial, converted (recharged), lapsed (trial done,
  never recharged).
- Conversion rate from trial completion to first recharge — the single clearest
  indicator of whether the price is right.
- Time from signup to first won deal, and from third free deal to first recharge.

---

## 6. Suggested build order

**Phase 1 — foundation (nothing works without these)**
AUC-57 (categories) → AUC-48 (wallet + ledger) → AUC-51 (rate config) → AUC-65 (audit log)

**Phase 2 — money moves**
AUC-49 (recharge + webhook) → AUC-50 (bill at lock) → AUC-53 (balance gating) →
AUC-52 (free trial) → AUC-63, AUC-64 (admin wallet + manual adjustment)

Do not ship Phase 2 partially. Billing at lock without balance gating means shops go
negative; gating without recharge means shops are locked out with no way back in.

**Phase 3 — quality and visibility**
AUC-54 (reversals) → AUC-70 (dispute queue) → AUC-58, AUC-59 (product categories +
matching) → AUC-69 (revenue v2) → AUC-68 (leakage) → AUC-71 (search/export)

**Phase 4 — polish**
AUC-55, AUC-56, AUC-60, AUC-61, AUC-62, AUC-67, AUC-72, AUC-73

---

## 7. Open decisions still needing the founder

1. **Multi-category override.** Spec §9 puts multi-category out of MVP scope. AUC-57
   overrides it. Confirm explicitly.
2. **Wallet float is a liability.** Shops' unspent balance is money owed as service.
   Decide the refund policy for a shop that leaves with a balance, before the first
   shop asks.
3. **Trial count.** 3 free deals is a judgement call, not a derived number. Worth
   revisiting after ~50 shops have passed through it.
4. **Price guarantee on confirmation** (AUC-56). Making the bid price conditional on
   in-app confirmation is the strongest enforcement lever available, but it is a
   customer-facing promise with support implications. Founder call.
5. **Category self-switching.** AUC-62 requires admin approval to change category.
   Confirm this is acceptable friction.
6. **GST — blocking for month two, not for the pilot.** No GST registration exists
   today, which is one reason monetization is parked (§0).

   Two separate questions, both for a CA — not to be answered from this document:

   - **Turnover threshold.** Services generally require registration above ₹20 lakh
     annual turnover. Pilot-scale projections (§2.3) are far below that.
   - **E-commerce operator status.** A platform facilitating supply between buyers and
     sellers may be classed as an *electronic commerce operator*, for which registration
     is mandatory from the first rupee regardless of turnover. Whether a lead/matching
     platform that never touches the transaction falls under this is genuinely unclear
     and is the question to put to a CA.

   Also unresolved: invoicing shops for recharges, GSTIN capture at onboarding, and
   input credit. **Settle this before switching on billing, not after.**

---

## 8. What this document does not cover

- GST invoicing and tax compliance (see §7.6)
- Refund of wallet balance to a departing shop
- Any change to customer-side pricing — customers remain free
- Featured/priority bid placement (spec §5 secondary, still post-MVP)
- Shop analytics subscription (spec §5 secondary, still post-MVP)
