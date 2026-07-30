#!/usr/bin/env node

require("dotenv").config();
const Sentry = require("@sentry/node");

const dsn = process.env.SENTRY_TEST_DSN || process.env.SENTRY_DSN;
if (!dsn) {
  console.error("[sentry-test] Set SENTRY_TEST_DSN or SENTRY_DSN before sending a test event.");
  process.exit(1);
}

Sentry.init({ dsn, environment: process.env.NODE_ENV || "production" });
Sentry.captureMessage("Uzuri Living alert drill", {
  level: "error",
  tags: { alert_drill: "true", source: "backend-script" },
});

Sentry.flush(5000).then((sent) => {
  if (!sent) {
    console.error("[sentry-test] Timed out sending the test event.");
    process.exit(1);
  }
  console.log("[sentry-test] Test event sent. Confirm the alert destination receives it.");
});
