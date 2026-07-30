# Changelog â€” Uzuri Living

All notable changes to Uzuri Living are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] - Android 16 Play Readiness

### Added

- Added opt-in browser push infrastructure: tenant-scoped subscriptions, alert preferences, queued deliveries, retry handling, and admin delivery health.
- Added privacy-safe authenticated Android shortcut analytics for Sale, Stock, and Debts. No sales, customer, debt, or payment data is recorded in these events.

### Changed

- Updated the Android release to target Android 16 (API 36), meeting the Google Play update requirement effective 31 August 2026.
- Raised the Android wrapper's Java compatibility to Java 17 and disabled device backup for the business app wrapper.
- Corrected Trusted Web Activity navigation-bar divider metadata so Android system-bar styling is applied reliably.
- Updated Android Browser Helper to `2.7.2` for the current Trusted Web Activity runtime.
- Added Android long-press shortcuts for recording sales, inventory, and customer debts.
- Added an ignored local signing-properties option for release builds so upload-key credentials stay out of Git.
- Added CI coverage for the Android wrapper, API 36 target, live PWA manifest, Digital Asset Links, and Android shortcuts.

---

## [1.4.1] - 2026-07-12 - Shop Attendant Privacy Controls

### Added

- Added independent `Record expenses` staff permission so expense entry does not require access to reports.
- Added shop attendant configuration for selling, stock adjustments, debts, and expense entry without owner financial visibility.
- Added migration `20260712002000_staff_expense_permissions`; existing owners and managers retain expense access.

### Fixed

- Redacted buying costs, sale profit, and margin details from staff sessions without report permission in backend responses and mobile screens.
- Updated staff, README, testing, and launch documentation with the attendant permission model.

---

## [1.4.0] - 2026-07-11 - Financial Integrity and Secure Mobile Sessions

### Added

- Added idempotent sale references so an offline retry cannot create a second sale or deduct stock twice.
- Added immutable debt-payment records with payment method, reference, note, timestamp, and guarded concurrent updates.
- Added supplier ownership controls: merchants can edit only supplier records created by their own shop; admins retain full control.
- Added supplier catalog import into merchant inventory and the supplier-order workflow, with merchant-set retail price and delivery-based stock receipt.
- Added a same-origin `/_api` frontend proxy so secure HttpOnly sessions work reliably on mobile browsers.

### Fixed

- Converted all money storage to whole TZS integers, removing floating-point drift from sales, debts, expenses, orders, products, and subscriptions.
- Replaced direct `X-Forwarded-For` rate-limit parsing with Supabase proxy-aware `req.ip` handling.
- Removed browser-stored access tokens and added Content Security Policy, permissions, referrer, and content-type headers.
- Rebuilt the mobile homepage navigation as a compact menu drawer and added a visible catalog H1 for accessibility and SEO.
- Updated compatible production dependencies and resolved reported production `npm audit` advisories.

---

## [1.3.0] - 2026-07-10 - Live Business Logic Hardening

### Added

- Added live database-backed staff permission checks so role changes and deactivation take effect immediately.
- Added explicit Basic/Pro entitlements: trials keep full access, Basic keeps core operations and exports, and Pro unlocks staff accounts and the AI command center.
- Added idempotent subscription payment confirmation using normalized payment references and billing report IDs.
- Added per-staff language, profile, and PIN settings without mutating the shop owner's account.
- Added real merchant alerts for low stock, debts, customer orders, sync failures, and subscription action.
- Added merchant catalog publishing controls, public catalog pagination, and demo/QA exclusion.
- Added migration `20260710001000_launch_hardening`.
- Added Android release metadata for version `1.0.2` (`versionCode 3`).

### Fixed

- Enforced forward-only customer-order transitions and guarded stock reservation against concurrent confirmation.
- Prevented duplicate supplier-delivery confirmation from adding stock twice.
- Made manual stock adjustments conflict-aware and required whole-number inventory quantities.
- Calculated daily and monthly dashboard boundaries in Tanzania time (`UTC+3`).
- Fixed merchant billing history to read from `/reports/my`.
- Separated local unit tests from production monitors so `npm test` cannot consume live login limits.
- Scoped authentication rate limits by client and phone number to reduce carrier-NAT lockouts.
- Fixed mobile AppShell width overflow, exposed Settings and customer orders in navigation, enlarged inventory actions, and added a sticky mobile cart summary.
- Removed Android notification permission until delegated push notifications are implemented.

---

## [1.2.1] - 2026-07-08 - Launch Operations Hardening

### Added

- Added merchant AI action history at `/assistant/history`.
- Added admin assistant analytics for tracked, opened, completed, and dismissed recommendation actions.
- Added admin sync support tools for per-shop/per-device sync history, device labels, resolution status, and resolution notes.
- Added subscription support controls for active-until visibility, extending plans from the existing paid-through date, removing subscriptions, and recording manual payment references.
- Added supplier verification/admin notes plus admin removal tools.

### Fixed

- Hardened the admin dashboard initial load so optional widgets cannot blank the whole admin area if one support endpoint fails.
- Guarded sale stock deduction inside the transaction to prevent negative stock during concurrent checkouts.
- Clamped manually created debt payments so a new debt cannot start with `amountPaid` above the total debt amount.

---

## [1.2.0] â€” 2026-06-08 â€” Uzuri Living Rebrand & Operations

### Added

- Rebranded product, package names, logo asset, manifest, and public pages to **Uzuri Living**.
- Added public `/about`, `/terms`, and `/privacy` pages with English/Swahili switching.
- Added public `/contact`, `/help`, and `/demo` pages.
- Added `/onboarding` as a five-step merchant setup checklist after registration.
- Added debt tracking with automatic debt creation for credit sales and payment status tracking.
- Added expense tracking by category.
- Added staff role management with PIN login and backend permission enforcement for selling, stock, staff, and reports.
- Added `/assistant` as the Uzuri Living AI Assistant positioning and ranked recommendation surface.
- Added `npm run monitor:prod` for production health, CORS, catalog, login, dashboard, and stale API URL checks.
- Added manual subscription payment records, admin plan activation controls, shop suspension, and mutation-level subscription enforcement.
- Added merchant `/billing` page with M-Pesa payment instructions, payment reference submission through support reports, and WhatsApp handoff.
- Added admin business-operations metrics for active shops, trials, expiring trials, unpaid/suspended shops, billing requests, support issues, and suspicious auth/error activity.
- Added a 14-day trial date at merchant registration plus a migration to backfill free-trial shops missing trial dates.
- Added staff PIN reset support for admins.
- Added browser-local offline sales queue with retry-on-reconnect sync, visible sync history, and retry error messages.

### Fixed

- Improved `/pricing` with plan fit, inclusions, WhatsApp CTAs, and consistent public links.
- Improved `/catalog` empty/search state with merchant education, demo shop links, and WhatsApp/register CTAs.
- Improved AI Assistant cards with why-it-matters notes and direct workflow links.
- Improved AI Assistant into a daily command list with expected impact and a WhatsApp-style owner summary.
- Improved onboarding into a tracked setup checklist including staff setup.
- Improved public trust pages with payment/support/offline/demo guidance.
- Updated production API defaults to `https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api`.
- Allowed `https://www.uzuriliving.com`, `https://uzuriliving.com`, and the Vercel fallback URL in backend CORS.
- Bumped the service-worker cache to `uzuriliving-v2` and stopped precaching `/` so stale login code does not persist after deploys.
- Updated express-rate-limit key generation to use the IPv6-safe helper.

---

## [1.1.0] â€” 2026-05-28 â€” Stability & Infrastructure Hardening

### Fixed

#### Backend â€” Express 5 error propagation

- All async controller functions in `sale`, `order`, `supplier`, `stock`, `dashboard`, `export`, `admin`, and `product` controllers were missing `asyncHandler` wrapping. Unhandled promise rejections now correctly propagate to the Express 5 error handler instead of crashing workers.
- `auth.controller.js` â€” `verifyOtp()` throws synchronously; it was not caught inside `asyncHandler`. Now wrapped in a `try/catch` that returns HTTP 400 instead of falling through to a 500.

#### Backend â€” Migration startup

- `scripts/migrate-and-start.js` â€” previously swallowed all migration errors silently. Now distinguishes "schema already current" (non-fatal, logs and continues) from unexpected failures (fatal â€” calls `process.exit(1)` so Supabase restarts rather than serving with a stale schema).

### Changed

#### Backend â€” Infrastructure

- `Dockerfile` upgraded from `node:20` to `node:24-alpine`.
- Added `postgresql-client` to the Docker image (required by `scripts/backup.js` for `pg_dump`).
- Added explicit `COPY prisma.config.js ./` step so Prisma 7 CLI can find the datasource config inside the container.

#### Backend â€” Prisma config

- Removed duplicate `backend/prisma/prisma.config.js`. The canonical config is `backend/prisma.config.js` (the project root relative to the `backend/` working directory), which is where Prisma 7 CLI looks via c12/jiti.

#### Frontend â€” Tailwind 4

- Deleted `frontend/tailwind.config.ts` â€” Tailwind CSS 4 uses CSS `@theme` directives only; a JS config file is unused and misleading.

#### Frontend â€” TypeScript 6

- Removed `"ignoreDeprecations": "6.0"` from `frontend/tsconfig.json` â€” no longer needed after TypeScript 6 migration is complete.

### Added

#### Frontend â€” Sentry server-side init

- Added `frontend/src/instrumentation.ts` â€” required for `sentry.server.config.ts` to be loaded in Next.js 16. Without this file Sentry server-side error tracking was silently inactive.

#### Config

- `backend/.env.example` â€” documented `DATABASE_MIGRATE_URL` (public TCP proxy URL used by `migrate-and-start.js`).
- `frontend/.env.example` â€” created with `NEXT_PUBLIC_API_URL`, Sentry DSN vars, and app name.
- Both `package.json` files â€” added `"engines": { "node": ">=20" }`.

---

## [1.0.0] â€” 2026-05-26 â€” Go-Live Sprint

### Added â€” 1.0.0

#### Security & Authentication

- **OTP PIN recovery** â€” "Forgot PIN?" on login screen sends a 6-digit SMS code via Africa's Talking; user sets new PIN after verification.
- **Short-lived JWT (1h) + refresh token (30d)** â€” access tokens now expire in 1 hour; frontend silently refreshes via the secure `uzuriliving_refresh` cookie; `/api/auth/refresh` endpoint added.
- **Logout endpoint** â€” `POST /api/auth/logout` clears both auth cookies.
- **Change PIN from settings** â€” authenticated users can change PIN by providing current PIN + new PIN via `PATCH /api/settings/pin`.
- **Admin PIN reset** â€” admins can look up any user by phone and reset their PIN via `PATCH /api/admin/users/:id/reset-pin`; all resets are audit-logged.
- **Public catalog rate limiting** â€” `/api/public/*` routes now have a separate limiter (30 req / 15 min per IP).
- **`/status` endpoint** â€” richer than `/health`; includes DB ping latency, uptime seconds, version, and environment.

#### Product Features

- **Settings page** (`/settings`) â€” merchants can update shop name, city, district, category, display name, language, and PIN from one place.
- **Customer orders view** (`/orders/customers`) â€” merchants see all inbound customer orders from their public shop catalog with status management (Confirm â†’ Dispatch â†’ Deliver / Cancel).
- **CustomerOrder stock deduction** â€” confirming a customer order decrements inventory; cancelling a CONFIRMED order releases stock back.
- **Registration form improvements** â€” registration now collects shop city, district, and category.
- **Admin dashboard UI** (`/admin`) â€” system overview stats, user list, PIN reset tool, and audit log viewer.
- **Africa's Talking OTP service** â€” full SMS OTP integration; falls back to console logging in dev when `AT_API_KEY` is not set.

#### Reliability & DevOps

- **pg_dump backup script** (`backend/scripts/backup.js`) â€” runs `pg_dump | gzip`, retains configurable number of days, scheduled via cron or Supabase cron service.
- **Sentry error tracking** â€” backend `@sentry/node`; frontend `@sentry/nextjs`; both are no-ops when DSN env vars are not set.
- **`normalizeBaseUrl`** in frontend API client strips trailing newlines from `NEXT_PUBLIC_API_URL`.

### Changed â€” 1.0.0

- JWT access token expiry changed from 30 days to 1 hour (with refresh token for transparent re-auth).
- `uzuriliving_token` cookie now holds short-lived access token; new `uzuriliving_refresh` cookie added for 30-day refresh.

---

## [0.9.0] â€” Pre-Launch

### Added â€” 0.9.0

- Customer orders & public shop catalog (B2B2C channel)
- Wholesale pricing tier (retail / wholesale per product)
- Sale channels (POS / ONLINE) on sales records
- Admin routes and audit logging middleware
- Cookie-based authentication alongside Bearer token
- Expiry date tracking on products
- CSV export (sales + inventory) for merchants

### Existing Features (initial build)

- Merchant dashboard with period filters, charts, payment mix, all-time business history
- POS / sales entry with all Tanzanian payment methods
- Inventory management with low-stock alerts and stock adjustments
- Supplier ordering with WhatsApp export (Kiswahili message)
- One-tap reorder from previous orders
- Delivery confirmation with automatic stock restocking
- Supplier portal with order status management
- Full Kiswahili / English interface with per-user language preference
- Rate limiting (API + auth endpoints)
- Docker + Docker Compose for local development
- CI: backend unit tests, frontend typecheck, Playwright E2E, npm audit
