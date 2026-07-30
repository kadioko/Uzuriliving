# Production Alerts And Restore Drill

## Scheduled Monitor

The `Production Monitor` GitHub workflow runs at 17 and 47 minutes past each hour. It checks Supabase health, the Vercel frontend, catalog proxy, CORS, login, an authenticated dashboard request, and an invalid-token response.

Before relying on it, add these repository secrets in GitHub Actions:

- `MONITOR_LOGIN_PHONE`
- `MONITOR_LOGIN_PIN`

On failure, the workflow opens one `Production monitor failure` issue. Watching the repository or enabling GitHub issue notifications is the Supabase uptime alert destination.

## Sentry Alert Destination

1. Set `SENTRY_DSN` on Supabase and `NEXT_PUBLIC_SENTRY_DSN` on Vercel.
2. In Sentry, create an issue alert for any new error in the `production` environment.
3. Send it to the founder's email or Slack/WhatsApp bridge; use email first if no bridge is available.
4. Send one test event with `npm run sentry:test` from `backend/` after setting `SENTRY_TEST_DSN` locally or in a secure runner.
5. Confirm both the event and notification arrive, then resolve the test issue.

## Restore Drill

Never restore into the live Supabase database. Create an empty, temporary PostgreSQL database and download a recent encrypted/off-site backup to a secure machine.

```powershell
$env:RESTORE_DRILL_DATABASE_URL = "postgresql://...temporary-drill-db..."
$env:RESTORE_DRILL_BACKUP_FILE = "C:\secure\uzuriliving-backup.sql.gz"
$env:RESTORE_DRILL_CONFIRM = "RESTORE_INTO_NON_PRODUCTION"
cd backend
npm run db:restore-drill
```

Success means the restore completes and the script prints row counts for users, shops, products, and sales. Record the date, backup timestamp, duration, operator, and row counts in the incident log. Destroy the temporary database and downloaded backup after the drill.

Run this every quarter and after any backup-storage or migration change.
