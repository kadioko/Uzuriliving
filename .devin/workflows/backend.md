# Uzuri Living Backend â€” Development Workflow

## Stack

| | |
| --- | --- |
| Runtime | Node.js 24 |
| Framework | Express 5 |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Error tracking | Sentry (`@sentry/node`) |
| SMS / OTP | Africa's Talking |

---

## Quick Start

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET at minimum

npm install
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev        # nodemon on :4000
```

---

## Key Files

| File | Purpose |
| --- | --- |
| `src/app.js` | Express entry point â€” routes, CORS, middleware, error handler |
| `prisma/schema.prisma` | Full data model |
| `prisma.config.js` | Prisma 7 datasource config (read by CLI from CWD = `backend/`) |
| `prisma/seed.js` | Seeds 4 test accounts + demo data |
| `scripts/migrate-and-start.js` | Supabase startup: `prisma migrate deploy` then `node src/app.js` |
| `scripts/backup.js` | `pg_dump \| gzip` database backup |
| `scripts/smoke-test.js` | Production smoke test against live API |
| `src/middleware/auth.js` | JWT authentication middleware |
| `src/middleware/audit.js` | Audit trail â€” logs every mutating request to `AuditLog` |
| `src/middleware/rateLimit.js` | Rate limiters (API, auth, public) |
| `src/lib/prisma.js` | Prisma client singleton (pg adapter) |
| `src/lib/sentry.js` | Sentry init â€” no-op when `SENTRY_DSN` is unset |
| `src/services/otp.service.js` | Africa's Talking OTP â€” logs to console in dev |
| `src/services/whatsapp.service.js` | WhatsApp message builder (Kiswahili) |

---

## Controllers Pattern

Every exported handler must be wrapped with `asyncHandler`:

```javascript
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const myHandler = asyncHandler(async (req, res) => {
  // ...
});

module.exports = { myHandler };
```

Without this, unhandled promise rejections crash Express 5 workers instead of being caught by the error middleware.

---

## Error Handling

The global error handler in `src/app.js` catches everything forwarded by `next(err)`:

```javascript
app.use((err, req, res, next) => {
  const status = Number(err.status) || 500;
  const message = status >= 500 ? "Internal server error" : err.message;
  res.status(status).json({ error: message });
});
```

To return a specific HTTP status from a handler, attach `.status` to the error:

```javascript
throw Object.assign(new Error("Not found"), { status: 404 });
```

---

## Database

### Migrations (development)

```bash
npm run db:migrate -- --name describe_change   # creates migration file + applies it
npm run db:studio                               # Prisma Studio UI at localhost:5555
```

### Migrations (production)

```bash
npm run db:deploy   # prisma migrate deploy â€” applies pending migrations only
```

The Supabase startup script (`scripts/migrate-and-start.js`) runs this automatically. It uses `DATABASE_MIGRATE_URL` (public TCP proxy) because Supabase's private network isn't available at container startup.

### Seeding

```bash
node prisma/seed.js
# or
npm run db:seed
```

Seed uses `DATABASE_MIGRATE_URL` (falls back to `DATABASE_URL`) so it works both locally and via Supabase's public URL.

### Test accounts (PIN: 1234)

| Role | Phone |
| --- | --- |
| Admin | +255743910580 |
| Supplier | +255700000001 |
| Merchant (Duka la Amina) | +255700000002 |
| Test Merchant (Salum Pharmacy) | +255700000003 |

---

## Environment Variables

Copy `.env.example` to `.env`. Minimum required for local dev:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/uzuriliving"
JWT_SECRET="any-long-random-string"
```

For OTP to work in dev, add:

```env
AT_API_KEY=your_key
AT_USERNAME=sandbox
```

Without `AT_API_KEY`, OTP codes are printed to the console instead of sent via SMS.

---

## API Routes Summary

| Prefix | Auth | Description |
| --- | --- | --- |
| `/api/auth/*` | Public / Authenticated | Login, register, refresh, OTP |
| `/api/settings/*` | Authenticated | Shop + account settings |
| `/api/products/*` | Merchant | Inventory management |
| `/api/stock/*` | Merchant | Stock adjustments + movement history |
| `/api/sales/*` | Merchant | POS + sale history |
| `/api/orders/*` | Merchant | Supplier orders |
| `/api/customer-orders/*` | Merchant / Public | Customer orders + public catalog |
| `/api/suppliers/*` | Merchant + Supplier portal | Supplier CRUD + portal |
| `/api/dashboard/*` | Merchant | Business analytics |
| `/api/exports/*` | Merchant / Admin | CSV exports |
| `/api/admin/*` | Admin | User management + audit log |
| `/api/public/*` | Public | Shop catalog (rate-limited) |
| `/health` | Public | `{"status":"ok"}` |
| `/status` | Public | DB ping, uptime, version |

---

## Common Tasks

### Add a new route

1. Create `src/controllers/foo.controller.js` â€” export asyncHandler-wrapped functions.
2. Create `src/routes/foo.routes.js` â€” mount the controller with `authenticateToken` and role guards.
3. Mount in `src/app.js`: `app.use("/api/foo", fooRoutes)`.

### Add a new Prisma model

1. Add the model to `prisma/schema.prisma`.
2. Run `npm run db:migrate -- --name add_foo`.
3. Run `npx prisma generate` (or `npm run db:generate`).

### Run tests

```bash
npm run test:api      # Node test runner integration tests
npm run smoke:prod    # Smoke test against live production API
```

---

## Docker

```bash
# Build the backend image
docker build -t uzuriliving-backend .

# Or run everything with docker-compose from the repo root
docker-compose up --build
```

The Dockerfile:

- Base: `node:24-alpine`
- Installs `postgresql-client` for `pg_dump` backup support
- Copies `prisma.config.js` before `prisma generate`
- Default CMD: `node src/app.js` (Supabase overrides this via `Supabase.toml` to use `migrate-and-start.js`)

---

## Deployment (Supabase)

1. Supabase reads `backend/Supabase.toml` for the start command.
2. `scripts/migrate-and-start.js` runs `prisma migrate deploy` using `DATABASE_MIGRATE_URL`, then starts the app.
3. Set all required env vars in the Supabase service dashboard (see `README.md` â†’ Production Environment Variables).
4. Healthcheck: Supabase pings `/health` every 30s.
