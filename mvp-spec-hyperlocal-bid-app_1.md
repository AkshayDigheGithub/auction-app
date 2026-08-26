# MVP Specification: Hyperlocal Reverse-Auction Shopping App (India)

## 1. Product Summary

A hyperlocal reverse-auction marketplace for electronics (starting with mobile phones like iPhones). A customer posts a product request with their area (auto-detected or manual). Nearby shop owners see the request and place competing bids. The customer picks the best bid and locks the deal. The customer visits the shop and shows a QR code; the shop owner scans it to confirm the deal is complete.

**Market**: India only (MVP phase).
**Platform**: PWA (Progressive Web App) — no native app for MVP.

---

## 2. Core User Flow

1. **Customer** opens the web app, enters the product they want (e.g., "iPhone 15, 128GB") and their area (browser geolocation auto-detect, with manual entry fallback).
2. System finds shops within a configurable radius (e.g., 5 km) of that area using PostGIS geo-queries.
3. Matched **shop owners** get notified (push notification) of the new request.
4. Shop owners submit bids (price + optional note, e.g., "brand new, sealed box").
5. Customer sees a live-updating list of bids (via WebSocket).
6. Customer selects a bid and **locks the deal**.
7. System generates a **signed QR code** (deal ID + timestamp + hash, tamper-proof) shown to the customer.
8. Customer visits the shop, shows QR code.
9. Shop owner scans the QR via browser camera (no native app needed).
10. Backend validates the QR token → marks deal as **completed**.
11. Commission/lead-fee is triggered against the shop owner at this point.

---

## 3. User Roles

- **Customer**: posts requests, views bids, locks deals, shows QR at shop.
- **Shop Owner**: receives nearby requests, submits bids, scans QR to confirm deal.
- **Admin** (you): monitors requests/deals, manages shop onboarding/verification, handles disputes, views revenue dashboard.

---

## 4. Shop Owner Profile & Onboarding

Shop owners must create a lightweight profile before they can bid. This is required (not optional) for four reasons:

1. **Trust/fraud prevention** — without verification, anyone could pose as a shop and place a bid they never honor.
2. **Location matching** — the PostGIS radius query needs real shop coordinates to know which requests to notify a shop about.
3. **Payment/commission collection** — a UPI ID or bank account on file is needed to charge commission via Razorpay when a deal closes.
4. **Accountability for disputes** — a real identity tied to the shop is needed to enforce policy if a bid isn't honored or a complaint is raised.

**Minimum profile fields for MVP:**
- Phone number (OTP verified)
- Shop name
- Shop address (auto-filled via Google Places, owner confirms/adjusts pin on map)
- Shop category (single category at MVP — "Mobile & Electronics")
- UPI ID or bank account (for commission deduction/settlement via Razorpay Route)
- Optional: shop photo, GST number (skip mandatory GST at MVP — many small shops aren't GST registered; requiring it will reduce sign-ups)

**Verification approach for MVP:**
- Self-serve sign-up — shop owner fills profile, OTP-verifies phone, can immediately start bidding.
- No heavy KYC required at launch.
- Optional "Verified" badge added later — admin manually confirms shop existence (phone call or checking its Google Maps listing) and grants a badge. Unverified shops can still bid; verified badge is a trust signal layered on top, not a gate to entry. This mirrors how IndiaMART/JingleBid onboard sellers.

---

## 5. Monetization Model (MVP)

- **Primary**: Commission on deal closure — charged to shop owner at the QR-scan confirmation step (the natural, verifiable billing trigger).
- **Secondary (optional, post-MVP)**: Pay-per-lead fee for shop owners to bid; featured/priority bid placement; monthly subscription for shop analytics.
- Customer side stays **free** — customers are the demand-generation engine.

---

## 6. Tech Stack

### Frontend (PWA)
- **Next.js** (React) — SSR for fast load on slow networks, PWA-ready
- **Tailwind CSS** — styling
- **next-pwa** — service worker, offline support, installability
- **Web Push API** — bid/deal notifications

### Backend
- **Node.js + NestJS (or Express)** — REST/WebSocket API
- **PostgreSQL + PostGIS** — relational data + geo-radius queries
- **Redis** — real-time bid caching, session management
- **Socket.io** — live bid updates to customer

### Location Services
- **Google Maps Platform** (India pricing tier)
  - Geocoding API — convert manual area entry to coordinates
  - Places Autocomplete (session-token based, to minimize cost) — area/address entry
  - India-specific free tier: 70,000 free events/month for Essentials APIs (Geocoding, Autocomplete, Geolocation) — well above MVP-stage usage
  - **Action item**: set a hard billing cap/alert (e.g., $20–50/month) in Google Cloud Console from day one to avoid surprise charges

### QR Code Deal Confirmation
- `qrcode` (Node library) to generate — encode signed token (deal ID + timestamp + hash) to prevent forgery/reuse
- `html5-qrcode` (or similar JS lib) — browser-based camera scanning for shop owner, no native app required
- Backend validates token signature + expiry before marking deal complete

### Payments
- **Razorpay** — UPI, cards, wallets, payouts
  - No setup fee, no monthly fee, pay only on successful transactions
  - Flat 2% domestic transaction rate; UPI transactions are near-zero cost under RBI's Zero MDR mandate
  - Use **Razorpay Route** for split payments if commission needs automatic splitting

### Authentication
- Phone number + OTP (standard trust pattern in India)
- **MSG91** for OTP SMS delivery (cost-effective for India)

### Hosting
- **Vercel** — frontend (Next.js), free tier to start
- **Railway or Render** — backend + PostgreSQL, low-cost early stage
- Migration path: AWS Mumbai region or DigitalOcean Bangalore once scale demands it

---

## 7. Database Schema (Draft — Core Tables)

**users**
- id, phone_number, name, role (customer/shop_owner/admin), created_at

**shops**
- id, owner_user_id, shop_name, address, latitude, longitude, category, upi_id, verified (bool), created_at

**requests**
- id, customer_user_id, product_name, description, area_text, latitude, longitude, status (open/locked/completed/cancelled), created_at

**bids**
- id, request_id, shop_id, price, note, status (active/withdrawn/rejected/won), created_at

**deals**
- id, request_id, bid_id, customer_user_id, shop_id, final_price, qr_token, qr_status (pending/scanned/confirmed), commission_amount, commission_status (pending/paid), created_at, completed_at

---

## 8. Estimated Monthly Running Costs (MVP stage, excluding development)

| Item | Service | Est. Monthly Cost (₹) |
|---|---|---|
| Frontend hosting | Vercel | 0 – 1,700 |
| Backend + DB hosting | Railway / Render | 800 – 2,500 |
| Domain | .com / .in | 80 – 150 |
| SMS OTP | MSG91 | 1,500 – 3,000 (10–15k OTPs) |
| Maps (Geocoding/Places) | Google Maps Platform (India tier) | 0 – 5,000 (70k free events/month covers early stage) |
| Push notifications | Web Push / Firebase | 0 |
| Payment gateway | Razorpay | No fixed fee; ~2% on card txns, near-0% on UPI |
| SSL | Included (Vercel/Let's Encrypt) | 0 |
| Error monitoring | Sentry (free tier) | 0 |
| Transactional email | Resend / SendGrid free tier | 0 – 800 |
| **Total (early MVP)** | | **≈ ₹2,500 – 12,000/month** |

**Key risk to monitor**: Google Maps usage — set a billing cap immediately; costs can spike if autocomplete isn't session-token-based or if bot traffic hits the API.

---

## 9. MVP Scope (What to Build First)

**In scope:**
- Customer: post request (product + area), view live bids, lock deal, view QR
- Shop owner: view nearby requests, submit bid, scan QR to confirm
- Admin: basic dashboard (requests, deals, revenue, shop verification)
- Phone OTP auth for both roles
- Real-time bid updates (WebSocket)
- Signed QR generation + validation
- Razorpay integration for commission collection at deal confirmation

**Out of scope (post-MVP):**
- Native iOS/Android apps
- In-app chat/negotiation beyond bid price
- Multi-category products (start with phones/electronics only)
- Subscription plans, featured bids, advanced analytics
- Multi-city expansion beyond initial pilot city
- International markets (US/UK) — explicitly deferred

---

## 10. Open Decisions / Questions for Next Steps

- Which city to pilot in first, and how to source initial shop-owner sign-ups (manual outreach vs. self-serve)?
- Exact commission % or lead-fee amount to start with?
- Bid radius default (5 km?) — should this be customer-adjustable?
- Dispute handling process if a shop owner doesn't honor their bid, or a customer doesn't show up?
- Shop verification process before allowing them to bid (prevent fake/spam shops)?

---

*Document prepared as an MVP planning reference. Intended to be shared as context in future conversations for continued product/technical planning.*
