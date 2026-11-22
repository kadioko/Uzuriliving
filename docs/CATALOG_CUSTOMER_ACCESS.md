# Customer catalogue access

Shops can protect catalogue prices with two shared passwords: one for retail customers and a different one for wholesale customers. These passwords are separate from the owner's and staff members' Uzuri Living logins. Customers cannot use them to access internal shop tools.

## Set up access

1. The shop owner opens **Settings → Customer catalogue access**. Staff cannot change these credentials.
2. Choose and confirm a retail password and a different wholesale password. Each must be at least 10 characters and at most 72 UTF-8 bytes.
3. Save the passwords securely. They cannot be recovered or displayed after saving; the owner can set a new one if it is forgotten.
4. Select **Turn on price protection**. Both passwords must be set first.
5. Share the retail link with retail customers and the wholesale link with wholesale customers. Send each password separately from its link.

The shop also needs to be published in the public catalogue and have an active subscription or trial. A shop that is unpublished, suspended, or not eligible for catalogue access cannot be opened with a customer password.

## What customers see

- The retail session shows retail prices only.
- The wholesale session shows wholesale prices and any minimum quantity recorded for each product. If no wholesale price is set, it asks the customer to contact the shop; it does not reveal the retail price as a fallback.
- Protected catalogues are **view-only**. The old public order API is also blocked for protected shops, including requests from stale browser tabs.
- For now, product names, photos and stock remain visible without signing in, as they were before. Prices are removed from both the marketplace and the shop's public API responses. The team will decide the longer-term pre-login presentation later.
- The minimum quantity is informational while the catalogue is view-only. If ordering is introduced later, minimums must be enforced on the server for each product.

Each password is shared by a customer group. Anyone who receives it can pass it on or take screenshots, so it is not the same as individual customer accounts. If access is shared inappropriately, the owner can change that group's password. Existing sessions for that group then stop working on their next request. Sessions expire after 12 hours.

## Important rollout and recovery notes

- Protection is **off** until the owner sets both passwords and turns it on. Existing shops and ordering behaviour are not silently changed by deploying the feature. Until protection is on, the existing public catalogue continues to show retail and wholesale prices.
- Turning protection off makes both prices public again and re-enables the existing catalogue ordering flow. The settings screen asks for confirmation before doing this.
- Password changes do not delete products, change stock, or affect owner/staff PINs. Existing information already copied by a customer cannot be recalled.
- If a customer sees an incorrect-password message, check the customer type and share the matching password. If too many attempts are made, wait 15 minutes. If the browser does not retain the session, enable cookies and try again.
- Products without stock are omitted, following the existing catalogue behaviour.

## Deployment and checks for maintainers

Apply `20261122010000_catalog_price_access.sql` before deploying the Edge Function that reads the table, then deploy the frontend. Do not enable protection for a shop until both deployments have succeeded. Confirm the owner sets the passwords through Settings; never put them in URLs, source control, logs, or support messages.

Run `node --test supabase/tests/catalog_security.test.mjs`, the frontend mocked Playwright suite, and the local integration test against a disposable local Supabase stack. `catalog_integration.test.mjs` requires `CATALOG_TEST_DB_URL`, `CATALOG_TEST_API_URL`, and `CATALOG_TEST_JWT_SECRET`; it refuses non-local hosts and cleans up only its own uniquely named fixtures. Verify both old public endpoints omit protected prices, customer sessions remain shop- and tier-scoped, password changes revoke the appropriate group, the legacy order endpoint rejects protected shops, and owner/staff sessions remain unaffected.
