const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

// Limit pool to 5 connections to avoid exhausting Supabase Hobby PostgreSQL.
// Use DATABASE_URL directly — connection_limit is set via Pool options.
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);

const prisma = global.__prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

module.exports = prisma;
