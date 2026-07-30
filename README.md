# Uzuri Living — Merchant OS for Tanzania

Uzuri Living helps Tanzanian merchants manage stock, sales, debts, expenses, supplier orders, customer orders, and daily business decisions from a phone.

Production app: [uzuriliving.com](https://uzuriliving.com)

## Current architecture

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Supabase Edge Function: `api` |
| Database | Supabase Postgres |
| Storage | Supabase Storage, including the `product-images` bucket |
| Hosting | Vercel frontend + Supabase backend |
| Authentication | Phone + PIN with secure HttpOnly access and refresh cookies |
| OTP | Africa's Talking integration when production secrets are configured |
| Payments | Cash, Bank, Credit, M-Pesa, Tigo Pesa, Airtel Money, HaloPesa |

The `backend/` directory contains legacy/local tooling and schema references. Production API traffic is handled by Supabase Edge Functions.

## Main capabilities

- Merchant dashboard with sales, profit, expenses, debts, stock alerts, and orders.
- Inventory with barcode support, stock counts, suppliers, expiry dates, and product images.
- Product images restricted to JPG, PNG, and WebP, maximum 1 MB and maximum 2400 × 2400 pixels.
- POS sales, customer debts, expenses, supplier orders, and public customer orders.
- Supplier portal and staff permissions.
- Admin user visibility, reports, subscriptions, audit logs, and operational monitoring.
- Kiswahili-first interface with English support.

## Repository layout

```text
frontend/                 Next.js web application
supabase/functions/api/   Supabase Edge Function API
supabase/migrations/      Supabase database migrations and demo seed
docs/                     Operations, email, launch, and test documentation
android/                  Trusted Web Activity configuration
marketing/                Uzuri Living marketing assets
```

## Local frontend development

```bash
cd frontend
npm ci
npm run dev
```

Set `NEXT_PUBLIC_API_URL` only when pointing to a local or alternate API. Production defaults to:

```text
https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api
```

## Supabase deployment

```bash
supabase functions deploy api --project-ref ryadgenkvhgxjdyhbyqc --no-verify-jwt
```

Apply migrations through the linked Supabase project before deploying frontend changes that depend on new database columns or buckets. Keep `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, Africa's Talking credentials, VAPID keys, and other secrets in Supabase secrets; never commit them.

## Verification

```bash
cd frontend
npm run typecheck
npm run build
```

Use [TESTING.md](./TESTING.md) for the current production smoke checklist and [docs/TEST_USERS.md](./docs/TEST_USERS.md) for the demo merchant account.

## Documentation

- [Test users](./docs/TEST_USERS.md)
- [Email setup](./docs/EMAIL.md)
- [Barcode management](./docs/BARCODE_MANAGEMENT.md)
- [Production alerts and restore](./docs/PRODUCTION_ALERTS_AND_RESTORE.md)
- [Launch playbook](./docs/LAUNCH_PLAYBOOK.md)
- [Marketing assets](./marketing/README.md)
