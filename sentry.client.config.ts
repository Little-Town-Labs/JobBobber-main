import * as Sentry from "@sentry/nextjs"

/**
 * Sentry client-side configuration.
 *
 * Initialises Sentry in the browser bundle.
 * tracesSampleRate: 1.0 in dev (all traces), 0.1 in production (10% sampling).
 *
 * @see FR-028 — performance monitoring requirement
 */
Sentry.init({
  dsn: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
  debug: process.env["NODE_ENV"] === "development",
  // Replay is opt-in — enable in production once privacy review is complete
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
})
