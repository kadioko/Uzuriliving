# Uzuri Living Launch Playbook

Last updated: 2026-07-10

This is the working plan for turning the live Uzuri Living product into active merchants, paid shops, and supplier relationships.

## Live Site Review

Production is live at:

- App: https://www.uzuriliving.com/
- API health: https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/health
- API status: https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/status

What is strong:

- The domain, HTTPS redirect, Vercel hosting, Supabase API, and production database are working.
- Push launch: deploy migration `20260722001000_push_notifications_and_app_usage`, set `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` in Supabase, then create a dedicated Supabase cron service with start command `npm run push:process` and schedule `0 5 * * *` UTC. Do not expose or commit the private VAPID key.
- The product already has the critical merchant workflow: registration, inventory, sales, debts, expenses, staff, billing, catalog, supplier orders, AI assistant, Swahili/English, and WhatsApp support.
- Pricing is understandable for Tanzania: free trial, TZS 15,000/month Basic, TZS 35,000/month Pro.
- The product has a natural sales motion: WhatsApp support plus M-Pesa payment reference verification.
- Admin support now has subscription controls, supplier verification, assistant action analytics, and offline sync resolution by shop/device.
- The assistant direction is stronger: Uzuri Living should be sold as the app that tells a shop owner what to do next, not only as POS/inventory.

What should improve before scaling ads:

- The homepage is currently login-first. That is good for returning users, but cold visitors need a clearer promise before the form: "Track stock, sales, debts, and supplier orders in Kiswahili from your phone."
- Public pages should show screenshots or short videos of dashboard, sales, inventory, catalog, and AI Assistant.
- Keep Search Console verified, submit the sitemap after public-page changes, and build trustworthy local backlinks; technical metadata and structured data are already in place.
- Add a stronger WhatsApp CTA for people who are not ready to register: "Tuma WhatsApp tupange setup ya duka lako."
- Add social proof as soon as the first 3-5 real merchants are onboarded.
- Watch production support signals daily: failed logins, unpaid/expiring shops, unresolved sync failures, billing reports, and assistant actions that are opened but not completed.

## Positioning

One-line promise:

> Uzuri Living helps Tanzanian shop owners track stock, sales, debts, expenses, and supplier orders in Kiswahili from their phone.

Short Swahili version:

> Uzuri Living hukusaidia kufuatilia stock, mauzo, madeni, matumizi na maagizo ya bidhaa kwa Kiswahili kwenye simu.

Primary buyer:

- Owner-operated shops in Dar es Salaam and other Tanzanian towns.
- Shops with daily stock movement, handwritten books, WhatsApp supplier ordering, and mobile-money payments.
- Best first verticals: grocery, pharmacy, cosmetics, mini-supermarkets, bars/restaurants, hardware, phone/electronics shops.

Primary pain:

- "Sijui stock imebaki ngapi."
- "Sijui faida ya leo."
- "Madeni yanasahaulika."
- "Order za supplier na customer ziko WhatsApp tu."
- "Mfanyakazi anaweza kuuza lakini owner haoni vizuri."

Primary hook:

- Do not lead with "software".
- Lead with money control: fewer stockouts, clearer profit, debt follow-up, and easier reorders.

## Offer

Default launch offer:

- 14-day free trial.
- Free WhatsApp setup call for the first 50 shops.
- TZS 15,000/month Basic after trial.
- No bank card required. Pay by M-Pesa and send the reference.

Founder-led close:

1. Ask for shop type, location, and number of products.
2. Create or guide registration.
3. Add 10-20 first products together.
4. Record one sample sale.
5. Show dashboard, low-stock alert, debt entry, and supplier WhatsApp order.
6. Schedule a 7-day check-in before trial ends.

## Acquisition Channels

Start with channels where trust is already high.

## SEO Launch Checklist

- Confirm `https://www.uzuriliving.com/robots.txt` allows public pages and points to `https://www.uzuriliving.com/sitemap.xml`.
- Submit `https://www.uzuriliving.com/sitemap.xml` in Google Search Console after each major public-page release.
- Request indexing for the homepage, `/pricing`, `/about`, `/help`, `/contact`, `/catalog`, and `/demo`.
- Keep private app pages out of the sitemap; focus crawlers on public, useful pages.
- Build branded backlinks from Instagram, WhatsApp business profile, field-sales materials, partner/supplier pages, and local business directories.
- Use the same entity details everywhere: Uzuri Living, Necuva Group Limited, `support@uzuriliving.com`, `+255743910580`, and `https://www.uzuriliving.com`.

### 1. Direct Field Sales

Target: 100 shops in 30 days.

Daily route:

- Visit 10-15 shops in one dense area.
- Ask for the owner, not only staff.
- Demo on the owner's phone.
- Register only shops that agree to add real products immediately.
- End with a WhatsApp follow-up message and support contact.

Best first locations:

- Kariakoo
- Ilala
- Kinondoni
- Mwenge
- Sinza
- Tegeta
- Buguruni
- Mbagala

Field pitch:

> Unaandika stock na mauzo kwenye daftari? Uzuri Living inakusaidia kujua stock iliyobaki, faida ya leo, madeni ya wateja, na muda wa kuagiza bidhaa tena. Ni Kiswahili, inatumika kwenye simu, na unaweza kujaribu bure siku 14.

### 2. WhatsApp Referrals

Every onboarded merchant should receive a share message:

> Nimeanza kutumia Uzuri Living kufuatilia stock, mauzo na madeni ya duka. Kama una duka, jaribu hapa: https://www.uzuriliving.com/

Referral offer:

- Referrer gets 1 free week after the referred shop records 10 real sales.
- Referred shop gets free setup.

### 3. Facebook And Instagram

Run small-budget tests only after the homepage/landing copy is sharpened.

Initial campaign:

- Objective: WhatsApp messages, not website clicks.
- Budget: TZS 10,000-20,000/day for 7 days.
- Geo: Dar es Salaam first.
- Language: Kiswahili.
- Audience interests: small business, retail, M-Pesa, business owners, wholesale, supermarket, pharmacy, cosmetics, hardware.

Ad angle examples:

- "Unajua faida ya leo?"
- "Stock ikiisha bila kujua, faida inapotea."
- "Duka lako kwenye simu: mauzo, stock, madeni na maagizo."
- "Acha daftari peke yake. Tumia Uzuri Living."

### 4. Supplier Partnerships

Suppliers are leverage because they already have merchant trust.

Pitch to supplier:

- Merchants can order faster through WhatsApp-ready purchase orders.
- Supplier can see incoming orders and route pending deliveries.
- Supplier gets cleaner demand data from repeat merchants.

Start with suppliers who serve many small shops in one category.

### 5. Demo Content

Record short phone-screen videos:

- Add product in under 30 seconds.
- Record sale and see profit.
- Create customer debt and mark paid.
- Low-stock item to supplier WhatsApp order.
- AI Assistant daily actions.

Post each video with a single CTA:

> Tuma WhatsApp tupange setup ya duka lako: +255 743 910 580

## 30-Day Launch Plan

Week 1: Trust and funnel cleanup

- Add stronger public homepage copy above the login form.
- Add screenshots/video to pricing, demo, and help pages.
- Add WhatsApp CTA to every public page.
- Confirm support@uzuriliving.com and WhatsApp response process.
- Prepare one-page setup checklist for field onboarding.

Week 2: Manual onboarding sprint

- Visit 50 shops.
- Register 20 trial shops.
- Ensure each trial shop adds at least 10 products and 5 real sales.
- Track objections in a spreadsheet or admin note.

Week 3: Referral and supplier loop

- Ask every active trial shop for 2 referrals.
- Approach 5 suppliers from merchant order data.
- Create 3 short demo videos from real workflows.
- Start a small WhatsApp-message ad campaign.

Week 4: Conversion

- Call every trial shop before day 10.
- Convert the most active shops to Basic.
- Offer Pro only when staff permissions, deeper reports/export, priority WhatsApp support, or daily AI workflows are clearly valuable.
- Publish first testimonial or case story.

## Metrics

Top-level weekly scoreboard:

- New registrations
- Shops that complete onboarding
- Shops with 10+ products
- Shops with 10+ sales
- Shops with 1+ supplier order
- Trial-to-paid conversion
- MRR
- WhatsApp leads
- Field demos completed

Activation definition:

> A merchant is activated when they add at least 10 products, record at least 10 real sales, and return to the app on a second day.

Do not optimize for signups alone. Optimize for activated shops and paid conversions.

## Launch Risks

- Too many trial signups with no product setup. Fix by doing guided setup.
- Ads send cold users to login-first screen. Fix with clearer public promise and WhatsApp CTA.
- Merchants forget to return after first setup. Fix with day-1, day-3, and day-7 WhatsApp follow-up.
- Payment friction. Keep M-Pesa reference flow simple and respond fast.
- Feature overload. In demos, show only the workflow that fits the shop.
- Deployment order. Supabase must complete pending migrations before Vercel users reach frontend features that depend on new columns.
- Catalog trust. Keep demo/QA shops unpublished and review wholesale prices before sharing a merchant catalog.
- Plan leakage. Test Basic and Pro entitlements after every billing or authorization change.
- Shared mobile IPs. Avoid repeated production login tests; use local unit/browser tests and one controlled production monitor.
- Shop attendant access: enable Sell, Stock, and Record expenses; keep Reports disabled. Verify the attendant can operate daily workflows without receiving buying costs, margins, shop-wide profit, or AI report data.

## Release Gate - 1.3.0

- Supabase migration: `20260710001000_launch_hardening`.
- Production monitor passes once after Supabase and Vercel deploy.
- Basic account cannot use staff or AI routes; Pro and active trial can.
- Duplicate payment reference returns the existing confirmation without extending time again.
- Customer orders follow `PENDING -> CONFIRMED -> OUT_FOR_DELIVERY -> DELIVERED`.
- Mobile Orders has no horizontal page overflow; Sales shows the sticky cart summary.
- Public catalog contains only published, non-demo shops and supports pagination.
- Android `1.0.3` / version code `4` targets API 36 and is signed with the existing upload key before Play Console upload.
- For local release builds, copy `android/keystores/signing.properties.example` to the ignored `signing.properties` file and keep its credentials in the password manager, never Git.

## Immediate Next Product Improvements

Highest impact for acquisition:

1. Public landing section above login that explains the value in Swahili and English.
2. Screenshot/video strip on homepage and pricing page.
3. WhatsApp lead CTA that pre-fills shop type and location.
4. Admin export or simple CRM notes for trial follow-up.
5. Public case-study/testimonial section once real merchants are onboarded.
