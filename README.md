# Uzuri Living â€” Merchant OS for Tanzania

> **Merchant operating system for informal retailers in Tanzania.**
> Track stock, record sales, order from suppliers, and grow your business â€” all in Kiswahili, from your phone.

---

## Why Uzuri Living

Tanzania has over **1 million informal operators** in Dar es Salaam alone, with wholesale/retail as the single largest segment. These merchants lose money every day from:

- Stockouts they never saw coming
- Cash they cannot reconcile
- Suppliers they can only reach by walking to the market
- Records kept in notebooks that get lost

Mobile money adoption is strong and growing. The infrastructure exists. What is missing is a tool built for how these merchants actually work â€” in Kiswahili, on a basic smartphone, with no training required.

Uzuri Living starts as **software + payments + procurement**, then layers working-capital financing later once trust and compliance are established.

---

## Live Production

- **Frontend:** [https://www.uzuriliving.com/](https://www.uzuriliving.com/)
- **Backend API:** [https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api](https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api)
- **Health:** [https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/health](https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/health)
- **Status:** [https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/status](https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/status)
- **Email:** Mailtrap for outbound app email; ImprovMX for inbound forwarding on `uzuriliving.com`
- **Launch playbook:** [docs/LAUNCH_PLAYBOOK.md](./docs/LAUNCH_PLAYBOOK.md)
- **Marketing assets:** [marketing/README.md](./marketing/README.md)

---

## What Uzuri Living Does

### For Merchants (Wafanyabiashara)

| Feature | Description |
| --- | --- |
| **Inventory tracking** | Add products, set buying/selling/wholesale prices, track stock levels |
| **Low-stock alerts** | Instant badge + dashboard alert when any product hits minimum stock |
| **POS / Sales entry** | Record sales by product, quantity, and payment method |
| **Debt tracking** | Credit sales automatically create receivables; every repayment is stored as a dated payment record |
| **Expense tracking** | Record rent, salary, utilities, stock, transport, marketing, tax, and other costs |
| **Staff roles (Pro)** | Add uniquely identified staff members; live permissions and deactivation are enforced on every request, including sell, stock, expense-entry, and report visibility |
| **Billing page** | Merchants can see plan status, official M-Pesa/Mix by Yas payment options, submit references, and contact WhatsApp support |
| **Subscription controls** | Admin can extend trials, mark manual M-Pesa payments, activate plans, and suspend shops |
| **Profit snapshot** | Real-time profit margin per sale and daily/weekly/monthly/all-time totals |
| **Business history** | All-time business history and monthly performance trends from the dashboard |
| **Supplier ordering** | Browse supplier catalog products, import them into inventory with a chosen retail price, then order and restock them safely |
| **WhatsApp export** | Every order generates a ready-to-send WhatsApp message in Kiswahili |
| **One-tap reorder** | Repeat any previous order with a single button |
| **Delivery confirmation** | Confirm goods received and auto-restock inventory |
| **Customer orders** | Public shop catalog; customers can place orders; merchant manages them |
| **Payment reconciliation** | Bank, M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, Cash, Credit |
| **Settings** | Update shop name, location, category, display name, language, and PIN in one place |
| **Uzuri Living AI Assistant (Pro)** | Daily command list with ranked recommendations, why-it-matters notes, expected impact, WhatsApp-style summary, and direct action links |
| **AI action history** | Merchants can review opened, completed, and dismissed AI actions from `/assistant/history` |
| **Offline sales queue** | Sales entered during connection loss are saved locally with an idempotent reference, show sync history/errors, and retry safely when the browser comes back online |
| **PIN recovery** | "Forgot PIN?" sends a 6-digit OTP via SMS (Africa's Talking) |
| **Language switching** | Full Kiswahili interface with an in-app English/Swahili toggle |
| **Operational alerts** | Actionable low-stock, debt, customer-order, offline-sync, and subscription notifications |
| **Catalog publishing** | Owners can publish or temporarily hide their public shop while cleaning products and prices |
| **CSV export** | Download sales history or full inventory as a CSV file |
| **Legal pages** | Public About, Terms, and Privacy pages with English/Swahili switching |
| **Onboarding + trust pages** | Contact, Help/FAQ, Demo accounts, and a guided five-step merchant onboarding checklist |

### For Suppliers (Wasambazaji)

| Feature | Description |
| --- | --- |
| **Order dashboard** | See all incoming orders from merchants |
| **Status management** | PENDING â†’ CONFIRMED â†’ OUT_FOR_DELIVERY (merchant confirms delivery) |
| **Route view** | Group pending orders by location |
| **Performance data** | Which merchants order most frequently |

### For Admins

| Feature | Description |
| --- | --- |
| **System overview** | User, shop, product, sale, order, active shop, trial, unpaid, suspended, billing, support, and suspicious-error counts |
| **User management** | List all users; look up any user by phone |
| **PIN reset** | Reset any user's PIN (all resets are audit-logged) |
| **Subscription desk** | Mark Basic/Pro payments, extend active plans from the current end date, remove subscriptions, and see valid-until dates |
| **Supplier verification** | Review suppliers, set verification status, add admin notes, and remove suppliers when needed |
| **AI analytics** | Track assistant actions, opened/completed/dismissed rates, and top action types |
| **Sync support** | View offline sync failures by shop/device, rename devices, and mark issues Open, Contacted, or Resolved |
| **Audit log viewer** | Searchable log of all significant actions |

---

## Revenue Model

| Stream | Target |
| --- | --- |
| Merchant subscriptions | ~300 merchants Ã— TZS 25,000/month = **TZS 7.5M MRR** |
| Supplier subscriptions | ~20 suppliers Ã— TZS 375,000/month = **TZS 7.5M MRR** |
| Transaction/procurement fees | % of GMV flowing through orders |
| Onboarding & training | One-time setup fees |
| **Working-capital financing** | Later stage, with BoT microfinance license or licensed partner |

**Path to TZS 25M MRR (~$10k/month):** 300 merchants + 20 suppliers + transaction fees + setup. No thousands of users needed before revenue.

---

## Launch And Growth

Uzuri Living is now live, so the operating focus is activated merchants, not just signups.

**Primary launch offer:** 14-day free trial, free WhatsApp setup for early shops, then TZS 15,000/month Basic or TZS 35,000/month Pro.

**Activation definition:** a merchant adds at least 10 products, records at least 10 real sales, and returns to the app on a second day.

**Best first channels:**

- Founder-led field sales in dense retail areas such as Kariakoo, Ilala, Kinondoni, Mwenge, Sinza, Tegeta, Buguruni, and Mbagala.
- WhatsApp referrals from onboarded merchants.
- Supplier partnerships with wholesalers already serving many small shops.
- Small Facebook/Instagram tests optimized for WhatsApp messages, not generic traffic.

See [docs/LAUNCH_PLAYBOOK.md](./docs/LAUNCH_PLAYBOOK.md) for positioning, ad copy, field-sales scripts, the 30-day launch plan, and the weekly metrics scoreboard.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Backend** | Node.js 24 Â· Express 5 Â· Prisma ORM 7 |
| **Database** | PostgreSQL |
| **Frontend** | Next.js 16 Â· React 19 Â· TypeScript 6 Â· Tailwind CSS 4 |
| **Auth** | Secure HttpOnly session cookies (1h access + 30d refresh) Â· phone + PIN login Â· OTP PIN recovery |
| **SMS / OTP** | Africa's Talking (sandbox in dev, live in production) |
| **Error tracking** | Sentry (`@sentry/node` + `@sentry/nextjs`) |
| **Messaging** | WhatsApp deep links + WhatsApp Cloud API (optional) |
| **Payments** | Cash, Bank, Credit, M-Pesa, Tigo Pesa, Airtel Money, HaloPesa |
| **Charts** | Recharts |
| **Containerisation** | Docker (node:24-alpine) + Docker Compose |
| **Hosting** | Supabase (backend + Postgres) Â· Vercel (frontend) |

---

## Authentication

- **Login:** phone number + PIN â†’ JWT access token (1h) + `uzuriliving_refresh` cookie (30d)
- **Refresh:** frontend silently renews the access token via `POST /api/auth/refresh` â€” no visible logout
- **PIN recovery:** "Forgot PIN?" on login screen â†’ 6-digit SMS OTP via Africa's Talking â†’ set new PIN
- **Change PIN:** authenticated users can change PIN from `/settings`
- **Admin PIN reset:** admin can reset any user's PIN via `/admin` (audit-logged)
- **Registration:** collects phone, PIN, name, role (MERCHANT / SUPPLIER), shop city, district, and category
- **Merchant trial:** new merchant shops receive a 14-day free trial on registration; existing missing trial dates are backfilled by migration.
- **Plan access:** a valid trial includes all features; Basic includes core shop operations and CSV exports; Pro adds staff accounts and AI workflows.

### Security Notes

- Rate limiting is applied on all `/api/*` routes (200 requests / 15 min). Authentication limits are scoped by Supabase-resolved client IP and phone number so unrelated mobile-network users do not lock each other out or spoof their way around the limit.
- Browser API calls use the same-origin `/_api` proxy and secure HttpOnly cookies. Access tokens are not stored in `localStorage`.
- All money values are stored as whole Tanzanian shillings (TZS), not floating-point values.
- Staff permissions are reloaded from the database on every authenticated request; disabling a staff account invalidates access immediately.
- Staff can be configured as a shop attendant: `canSell`, `canManageStock`, and `canRecordExpenses` may be enabled while `canViewReports` remains off. Staff without report access receive redacted buying-cost and profit fields, while owners/managers keep full financial visibility.
- Never commit real secrets to git â€” keep `DATABASE_URL`, `JWT_SECRET`, and payment credentials in environment variables only.
- OTP codes expire after 10 minutes and are single-use.
- Africa's Talking credentials must be verified separately in production; the production monitor does not send a real OTP.

---

## Project Structure

```text
Uzuri Living/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ prisma/
â”‚   â”‚   â”œâ”€â”€ schema.prisma          # Full data model
â”‚   â”‚   â”œâ”€â”€ seed.js                # Demo merchant + supplier data
â”‚   â”‚   â””â”€â”€ migrations/            # Prisma migration history
â”‚   â”œâ”€â”€ prisma.config.js           # Prisma 7 datasource config (read by CLI)
â”‚   â”œâ”€â”€ scripts/
â”‚   â”‚   â”œâ”€â”€ migrate-and-start.js   # Optional local Prisma startup helper
â”‚   â”‚   â”œâ”€â”€ backup.js              # pg_dump + gzip backup
â”‚   â”‚   â”œâ”€â”€ smoke-test.js          # Production smoke checks
â”‚   â”‚   â””â”€â”€ production-monitor.js  # Health/CORS/catalog/login monitor
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ app.js                 # Express entrypoint
â”‚   â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”‚   â”œâ”€â”€ prisma.js          # Prisma client singleton
â”‚   â”‚   â”‚   â””â”€â”€ sentry.js          # Sentry initialisation
â”‚   â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.js            # JWT middleware
â”‚   â”‚   â”‚   â”œâ”€â”€ audit.js           # Audit trail middleware
â”‚   â”‚   â”‚   â””â”€â”€ rateLimit.js       # express-rate-limit config
â”‚   â”‚   â”œâ”€â”€ controllers/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ product.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ sale.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ order.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ customerOrder.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ supplier.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ stock.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ dashboard.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ export.controller.js
â”‚   â”‚   â”‚   â”œâ”€â”€ settings.controller.js
â”‚   â”‚   â”‚   â””â”€â”€ admin.controller.js
â”‚   â”‚   â”œâ”€â”€ routes/                # One file per resource
â”‚   â”‚   â””â”€â”€ services/
â”‚   â”‚       â”œâ”€â”€ whatsapp.service.js   # WhatsApp message builder
â”‚   â”‚       â””â”€â”€ otp.service.js        # Africa's Talking OTP
â”‚   â”œâ”€â”€ Dockerfile                 # node:24-alpine
â”‚   â”œâ”€â”€ .env.example
â”‚   â””â”€â”€ package.json
â”‚
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”‚   â”œâ”€â”€ page.tsx               # Login / Register
â”‚   â”‚   â”‚   â”œâ”€â”€ dashboard/page.tsx     # Business overview + charts
â”‚   â”‚   â”‚   â”œâ”€â”€ inventory/page.tsx     # Product list, stock adjustment
â”‚   â”‚   â”‚   â”œâ”€â”€ sales/page.tsx         # POS + history
â”‚   â”‚   â”‚   â”œâ”€â”€ debts/page.tsx         # Customer credit / receivables
â”‚   â”‚   â”‚   â”œâ”€â”€ expenses/page.tsx      # Business expense tracking
â”‚   â”‚   â”‚   â”œâ”€â”€ staff/page.tsx         # Staff roles + permissions
â”‚   â”‚   â”‚   â”œâ”€â”€ assistant/page.tsx     # Uzuri Living AI Assistant insights
â”‚   â”‚   â”‚   â”œâ”€â”€ onboarding/page.tsx    # Merchant setup checklist
â”‚   â”‚   â”‚   â”œâ”€â”€ orders/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ page.tsx           # Supplier orders + WhatsApp
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ customers/page.tsx # Inbound customer orders
â”‚   â”‚   â”‚   â”œâ”€â”€ suppliers/page.tsx     # Supplier directory
â”‚   â”‚   â”‚   â”œâ”€â”€ supplier/page.tsx      # Supplier portal
â”‚   â”‚   â”‚   â”œâ”€â”€ settings/page.tsx      # Shop + account settings
â”‚   â”‚   â”‚   â”œâ”€â”€ admin/page.tsx         # Admin dashboard
â”‚   â”‚   â”‚   â”œâ”€â”€ catalog/               # Public shop catalog (B2B2C)
â”‚   â”‚   â”‚   â”œâ”€â”€ about/page.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ contact/page.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ help/page.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ demo/page.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ terms/page.tsx
â”‚   â”‚   â”‚   â””â”€â”€ privacy/page.tsx
â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â””â”€â”€ layout/AppShell.tsx    # Sidebar + mobile nav
â”‚   â”‚   â”œâ”€â”€ instrumentation.ts         # Sentry server-side init (Next.js 16)
â”‚   â”‚   â””â”€â”€ lib/
â”‚   â”‚       â”œâ”€â”€ api.ts                 # Typed fetch wrapper
â”‚   â”‚       â””â”€â”€ i18n.ts                # Kiswahili / English translations
â”‚   â”œâ”€â”€ sentry.client.config.ts
â”‚   â”œâ”€â”€ sentry.server.config.ts
â”‚   â”œâ”€â”€ .env.example
â”‚   â””â”€â”€ package.json
â”‚
â””â”€â”€ docker-compose.yml
```

---

## Database Schema

```text
User â”€â”€â”€â”€â”€â”€â”€â”€ Shop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Product â”€â”€â”€â”€â”€â”€â”€â”€ StockMovement
               â”‚                    â”‚
               â”œâ”€â”€â”€â”€ Sale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ (SaleItem)
               â”œâ”€â”€â”€â”€ Order â”€â”€â”€â”€ Supplier
               â”‚       â””â”€â”€â”€â”€â”€â”€ (OrderItem)
               â””â”€â”€â”€â”€ CustomerOrder
                         â””â”€â”€â”€â”€ (CustomerOrderItem)
```

**Core models:**

- `User` â€” merchant, supplier, or admin; identified by phone + PIN
- `Shop` â€” one shop per merchant (extensible to multi-shop); has name, location, district, category
- `Supplier` â€” can optionally have a User account (supplier portal)
- `Product` â€” SKU, buying/selling/wholesale price, stock level, minimum threshold, expiry date
- `Sale` + `SaleItem` â€” each sale records profit per line item; supports POS and ONLINE channels
- `Debt` â€” customer credit balances with open, partial, paid, and cancelled statuses
- `Expense` â€” merchant cost tracking by category and date
- `StaffMember` â€” staff roster with optional PIN login and role permission flags
- `StockMovement` â€” full audit trail of every stock change (IN / OUT / ADJUSTMENT)
- `Order` + `OrderItem` â€” merchant-to-supplier purchase orders with status lifecycle
- `CustomerOrder` + `CustomerOrderItem` â€” customer-to-merchant orders from public catalog
- `AuditLog` â€” records significant actions with user, method, path, IP, and metadata

---

## Getting Started

### Prerequisites

- Docker + Docker Compose, **or** Node.js 20+ and PostgreSQL

### Quick Start with Docker

```bash
git clone https://github.com/kadioko/Uzuriliving.git
cd Uzuriliving

# Copy and fill in env files
cp backend/.env.example backend/.env
# Edit backend/.env: set DATABASE_URL and JWT_SECRET

# Start everything
docker-compose up --build

# In a separate terminal â€” seed test data
docker-compose exec backend node prisma/seed.js
```

The app will be available at:

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:4000/api](http://localhost:4000/api)

### Local Development (without Docker)

```bash
# 1. Database
createdb uzuriliving

# 2. Backend
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev         # runs on :4000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev         # runs on :3000
```

### Local Verification Checklist

- Backend health responds at `http://localhost:4000/health`
- Status endpoint responds at `http://localhost:4000/status`
- Frontend loads at `http://localhost:3000`
- Test merchant can log in
- Dashboard `All Time` tab renders
- Sales page shows `Bank` as a payment option
- Language toggle persists after refresh

### Production Environment Variables

#### Supabase Edge Functions

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | `https://ryadgenkvhgxjdyhbyqc.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase-managed function secret; never expose to the browser |
| `JWT_SECRET` | Yes | Long random secret used by the compatibility API |
| `JWT_SECRET` | Yes | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `AT_API_KEY` | Recommended | Africa's Talking key for SMS OTP |
| `AT_USERNAME` | Recommended | Africa's Talking username (`sandbox` for testing) |
| `VAPID_SUBJECT` | Required for push | `mailto:support@uzuriliving.com` |
| `VAPID_PUBLIC_KEY` | Required for push | Public Web Push key |
| `VAPID_PRIVATE_KEY` | Required for push | Private Web Push key; never commit it |
| `AT_API_KEY` | Recommended | Africa's Talking key for SMS OTP |
| `AT_USERNAME` | Recommended | Africa's Talking username (`sandbox` for testing) |
| `AT_SENDER_ID` | Optional | Custom SMS sender ID |
| `MAIL_FROM` | Optional | Outbound sender, for example `Uzuri Living <noreply@uzuriliving.com>` |
| `MAIL_REPLY_TO` | Optional | Reply-to address, usually `support@uzuriliving.com` |
| `MAILTRAP_API_TOKEN` | Optional | Mailtrap Email API token for outbound email |
| `MAILTRAP_SMTP_HOST` | Optional | Mailtrap SMTP host, usually `live.smtp.mailtrap.io` |
| `MAILTRAP_SMTP_PORT` | Optional | Mailtrap SMTP port, usually `587` |
| `MAILTRAP_SMTP_USER` | Optional | Mailtrap SMTP username |
| `MAILTRAP_SMTP_PASS` | Optional | Mailtrap SMTP password |
| `SENTRY_DSN` | Optional | Sentry project DSN for error tracking |
| `VAPID_SUBJECT` | Required for push | `mailto:support@uzuriliving.com` |
| `VAPID_PUBLIC_KEY` | Required for push | Public key from the private Uzuri Living secrets vault |
| `VAPID_PRIVATE_KEY` | Required for push | Private key from the private Uzuri Living secrets vault. Never commit it. |
| `WHATSAPP_API_URL` | Optional | WhatsApp Cloud API URL |
| `WHATSAPP_API_TOKEN` | Optional | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_ID` | Optional | WhatsApp Business phone number ID |
| `BACKUP_DIR` | Optional | Directory for pg_dump backups (default: `./backups`) |
| `BACKUP_RETAIN_DAYS` | Optional | Days to keep backups (default: `7`) |

#### Frontend (Vercel)

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | `https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api` â€” no trailing slash or newline |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry DSN for client-side error tracking |
| `SENTRY_DSN` | Optional | Sentry DSN for server-side (SSR) error tracking |

### Supabase deployment workflow

- **Database migrations:** `supabase db push --linked --yes`
- **API deployment:** `supabase functions deploy api --project-ref ryadgenkvhgxjdyhbyqc --no-verify-jwt --yes`
- **Storage:** private bucket `uzuri-uploads`, served through signed upload URLs from the API.
- **Secrets:** configure `JWT_SECRET`, Africa's Talking credentials, and VAPID keys with `supabase secrets set`.

### Deployment Checklist

1. Push changes to `main`.
2. Confirm Supabase has the function secrets listed above.
3. Deploy the `api` Edge Function and apply the linked database migrations.
4. Deploy frontend on Vercel with `NEXT_PUBLIC_API_URL=https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api`.
5. Verify Supabase healthcheck path is `/health`.
6. Run `cd backend && npm run smoke:prod` and `cd frontend && npm run smoke` against the live URLs.
7. Run `cd backend && npm run monitor:prod` for health, CORS, catalog, login, dashboard, and stale API URL checks.
8. Run `cd backend && npm run email:dns-check` to verify Mailtrap outbound and ImprovMX inbound DNS.
9. Run `cd frontend && npm run smoke:login` for the browser login/dashboard/sales/logout smoke flow.
10. Review `TESTING.md` for the full manual and automated test checklist.

### Launch Notes

- Staff members can log in with their phone and PIN after the owner creates them on `/staff`; backend route permissions enforce sell, stock, expense-entry, staff, and reports access for staff sessions. A shop attendant can sell, adjust stock, record debts, and record expenses without seeing shop-wide profit reports or buying costs.
- Offline support includes the cached app shell, `/offline.html` fallback, a browser-local pending sales queue, merchant sync history, and admin sync failure resolution by shop/device. Broader offline editing for inventory, debts, expenses, and catalog checkout is not enabled yet.
- The frontend calls the Supabase Edge Function directly; `NEXT_PUBLIC_API_URL` is the single API base URL.
- Expired or suspended shops can still view data and contact support, but operational mutations such as new sales, stock edits, expenses, staff changes, and orders require an active trial or subscription.
- Sale stock deduction is guarded inside the database transaction, so concurrent checkouts cannot push inventory below zero.
- Browser-extension console warnings from injected `contentscript.js` files are not Uzuri Living app errors; investigate Uzuri Living only when the failing URL is a Uzuri Living API/frontend URL.
- Push notifications are opt-in per browser/device. Run `npm run push:process` in a dedicated Supabase cron service once daily; it queues low-stock, overdue-debt, subscription, and opted-in AI alerts, then retries transient delivery failures. The API remains harmless until all three VAPID variables are set.

---

## Demo Accounts (after seeding)

Merchant and supplier demo PINs: `1234`. Admin credentials are not published in the repository.

| Role | Phone | Name / Shop | Key scenarios |
| --- | --- | --- | --- |
| **Merchant** | **+255700000002** | **Mama Amina / Duka la Amina** | **FEATURED** â€” 12 products (all stock/expiry states), 10 sales (all payment methods + wholesale + online), 5 supplier order statuses, 6 customer order statuses, stock movements IN/OUT/ADJUSTMENT |
| Merchant | +255700000003 | Bwana Salum / Salum Pharmacy | Pharmacy, Kinondoni â€” orders from Jumla Traders visible in supplier portal |
| Merchant | +255700000004 | Hassan Juma / Hassan Bar & Wines | Bar, Buguruni (Ilala) â€” wholesale sales + Rafiki Beverages orders |
| Merchant | +255700000005 | Fatuma Ally / Fatuma Beauty Shop | Beauty shop, Tegeta (Kinondoni) â€” online channel + Beauty Supplies TZ orders |
| **Supplier** | **+255700000001** | **Jumla Traders Ltd** | **FEATURED** â€” all 5 order statuses visible in supplier portal, orders from 2 merchants |
| Supplier | +255700000006 | Rafiki Beverages Ltd | Hassan's beverage supplier |
| Supplier | +255700000007 | Beauty Supplies TZ | Fatuma's cosmetics supplier |

> For a full per-scenario breakdown of what is seeded for Mama Amina and Jumla Traders, see [TESTING.md](./TESTING.md#featured-accounts--all-scenarios-reference).
