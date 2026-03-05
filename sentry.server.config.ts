import * as Sentry from "@sentry/nextjs"

/**
 * Sentry server-side configuration.
 * Instruments Next.js API routes and server components.
 */
Sentry.init({
  dsn: process.env["SENTRY_DSN"],
  tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
  debug: process.env["NODE_ENV"] === "development",
})
