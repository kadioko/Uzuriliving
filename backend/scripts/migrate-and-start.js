/**
 * Supabase startup script.
 * Runs prisma migrate deploy using DATABASE_MIGRATE_URL (public TCP proxy)
 * so it works before Supabase's private network is fully available.
 * If migrations fail, logs a warning and starts the app anyway — the schema
 * is already current from previous successful deploys.
 */
const { execSync } = require("child_process");
const path = require("path");

const appRoot = path.resolve(__dirname, "..");
// Prisma 7 reads datasourceUrl from prisma.config.ts, but we can override
// via DATABASE_URL env for the CLI invocation.
const migrateUrl = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;

console.log("Attempting prisma migrate deploy...");
try {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: appRoot,
    env: { ...process.env, DATABASE_URL: migrateUrl },
  });
  console.log("Migrations complete.");
} catch (err) {
  const msg = err.message || "";
  // Non-fatal: schema is already current or no pending migrations
  if (
    msg.includes("already applied") ||
    msg.includes("no pending migrations") ||
    msg.includes("up to date")
  ) {
    console.log("No pending migrations — schema already current.");
  } else {
    // Fatal: unexpected migration failure — exit so Supabase restarts rather than
    // serving traffic with a potentially outdated schema
    console.error("FATAL: Migration failed unexpectedly:", msg);
    process.exit(1);
  }
}

require(path.resolve(appRoot, "src/app.js"));
