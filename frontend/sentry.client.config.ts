/**
 * Sentry client-side configuration â€” Uzuri Living Frontend
 *
 * Required env var:
 *   NEXT_PUBLIC_SENTRY_DSN â€” your Sentry project DSN (public)
 *
 * If NEXT_PUBLIC_SENTRY_DSN is not set, Sentry is disabled.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
    integrations: [Sentry.replayIntegration()],
  });
}
