// Prisma 7 config — plain JS so it runs on Supabase without a TS compile step.
// Used by Prisma CLI (migrate deploy, generate). The running app uses
// @prisma/adapter-pg directly in src/lib/prisma.js.
const { defineConfig } = require("prisma/config");

module.exports = defineConfig({
  datasource: {
    url: process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL,
  },
});
