# Uzuri Living system audit — 17 October 2026

## Scope and conclusion

Reviewed the Next.js frontend, Supabase Edge API and migrations, production database metadata and aggregate integrity, local print bridge, Android printer activity, test tooling, and the live API. The main merchant journeys now pass automated and live checks. This does **not** establish that every device, printer, SMS provider, or future workflow is bug free.

## Important findings and repairs

| Area | Finding | Repair and evidence |
| --- | --- | --- |
| Database access | Application tables had row level security disabled and browser roles could access tables, including users and products. | `20261017000000_lock_down_application_tables.sql` enabled RLS and removed browser grants. Live metadata now shows **0** public tables without RLS and **0** browser table grants. Edge API continues to use its server-side service role. |
| Permissions | A selling cashier could not reliably load POS products; menu hiding alone did not stop direct API calls. | `permissions.ts` enforces feature permissions at the API, respects explicit manager restrictions, and redacts costs and incoming quantities. Live cashier and stock clerk requests returned the expected 200/403 responses. |
| Sales and stock | Multiple writes could leave a sale, debt, supplier receipt, stock count, or order out of sync after a partial failure or retry. | Applied transaction RPCs for sales, stock adjustments and counts, debt payments, supplier orders and receiving, customer order reservation, product opening stock, subscription payments, and account registration. `supabase/tests/shop_integrity.sql` exercises rollback, idempotency, and stale counts inside a rolled-back transaction. |
| Authentication | PIN attempts were not rate limited. Registration could leave an account without its related shop/supplier profile. | Rate limit table and RPC; registration is now atomic. A phone cannot belong to both a user and a staff login. Refresh tokens are rejected as API access tokens, and active roles/approval are checked against the database. |
| Reporting | Several totals and listings stopped at the Supabase 1,000-row response cap; inventory filtering could report the wrong total. | Paged reads now cover key dashboard, profit, purchases, expenses, debts, product performance, exports, public shop counts, and filtered inventory paths. CSV exports are implemented and escape spreadsheet formulas. |
| Product visibility | Incoming order status could disappear when quantities were redacted; sales barcode scans could use an old price mode. | Shared incoming status UI and current price-mode cart callback. Product performance also withholds supplier order quantities from staff without stock permission. |
| Offline sales | The old pending queue used one browser key across shops. | Pending sales and sync history are now shop scoped. Older unsent sales require an owner to review and import them; a backup is kept during import. |
| Time display | UTC timestamps without a `Z` were read as device-local timestamps. | Central date formatter now interprets these database timestamps as UTC before showing shop time. Regression test covers Africa/Nairobi. |
| Printer access | Android USB printing closed before the permission callback; the desktop bridge accepted all browser origins. | Android waits for permission and confirms the target before printing; bridge accepts configured Uzuri Living origins and requires a token when exposed beyond loopback. Android debug build and bridge tests passed. |
| Demo records | Four demo sales, one demo debt, and one demo supplier order had header/ledger totals that disagreed with their lines. | `20261017060000_reconcile_demo_ledgers.sql` repaired only shops marked `isDemo`. A repeat live aggregate check found **0** sales, debt, or supplier order mismatches. Real merchant records were not changed. |

## Verification completed

- Next.js production build and TypeScript check: passed.
- Deno Edge Function type check: passed.
- Backend and permission unit tests: **30 passed**.
- Mocked browser and accessibility checks: **10 passed**.
- Live Supabase API and role checks: **9 passed**, including owner, cashier, stock clerk, invalid writes, and CSV.
- Print bridge tests: **4 passed**.
- Database transaction integrity script: passed and rolled back all test fixtures.
- Android `:app:assembleDebug`: passed.
- `npm audit` for frontend and legacy backend: **0 known vulnerabilities** in each current lockfile.
- Live data checks: no negative stock, negative product prices, invalid debt balances, duplicate login phones, or sales/debt/order aggregate mismatches.

## Limits and follow up

- SMS PIN reset and browser push delivery lack their production provider secrets. The reset API now reports unavailable rather than claiming a message was sent. Configure and test the provider before relying on these functions.
- No XP-D281B/D281E or other physical printer was available for alignment, transport, barcode quality, or continuous label tests. Installed Android APKs must be updated to receive the native Java fix; deploying the website alone cannot update them. Direct iOS raw printing still needs a native adapter or tested bridge.
- Three inactive products in real shops still carry 99 units in total. This can be deliberate archiving. Ask those shop owners to review the products; do not reactivate them or rewrite inventory automatically. Receiving an inactive product will reactivate it.
- Live role tests covered owner, cashier, and stock clerk. The supplier portal was tested in mocked browser flows and the API was inspected, but no live supplier login or real fulfilment was exercised during this audit.
- The old `backend/` directory remains as legacy tooling. Production traffic uses the Supabase Edge Function. Its tests provide useful regression coverage but are not proof of every production route.

## Reproduction

See [TESTING.md](../TESTING.md) for commands and safe production checks. Apply migrations before deploying the Edge Function and frontend.
