# Uzuri Living Testing Guide

This guide describes the current Supabase/Vercel production setup. The old local multi-account seed scenarios are retired.

## Live services

| Service | URL |
| --- | --- |
| Frontend | [https://uzuriliving.com](https://uzuriliving.com) |
| API | [Supabase Edge Function](https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api) |
| Health | [API health](https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/health) |
| Status | [API status](https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api/status) |

## Test account

Use the demo merchant in [docs/TEST_USERS.md](./docs/TEST_USERS.md):

- Phone: `+255789123456` or `0789123456`
- PIN: `1234`
- Shop: Mwangaza Corner Market

Admin credentials are kept in the private team credential record and are not published here.

## Production smoke test

1. Open the live frontend.
2. Sign in with the demo merchant.
3. Confirm the dashboard shows seeded sales, profit, expenses, debts, low-stock products, and a pending supplier order.
4. Open Inventory and confirm the 10 demo products appear.
5. Open Sales and confirm historical sales load.
6. Open Debts and confirm one open and one partially paid debt.
7. Open Expenses and confirm transport and utilities entries.
8. Open Suppliers and Orders and confirm the seeded supplier and pending order.
9. Sign out and confirm the public login page returns.

## Admin smoke test

1. Sign in with a private admin account.
2. Open Admin → Users.
3. Confirm all current users appear, including the demo merchant, the two admins, and any later registrations.
4. Confirm overview counts match the user and shop data.
5. Confirm audit logs, reports, subscriptions, suppliers, and sync panels load without replacing valid data with empty fallback data.

## Product image test

1. Sign in as the demo merchant or another merchant.
2. Open Inventory and add or edit a product.
3. Upload a JPG, PNG, or WebP image under 1 MB and no larger than 2400 × 2400 pixels.
4. Save the product and confirm the thumbnail appears in the product list.
5. Try a non-image file, an image over 1 MB, or an image larger than 2400 × 2400 pixels; each must be rejected before upload.

## Automated checks

```bash
cd frontend
npm run typecheck
npm run build
npm run test:mocked
npm run test:a11y
```

The API should also be checked after every Edge Function deployment:

- `GET /health` returns a healthy response.
- `GET /status` reports database connectivity.
- CORS allows `https://uzuriliving.com` and `https://www.uzuriliving.com`.
- Demo login returns a session and profile.
- Authenticated dashboard and product requests return 200.
- Invalid credentials return 401 without leaking account details.

## Deployment order

1. Apply Supabase migrations.
2. Deploy the `api` Edge Function.
3. Build and deploy the frontend through Vercel.
4. Run the smoke checks above.

Never put service-role keys, JWT secrets, OTP credentials, VAPID private keys, or real customer data in this repository.
