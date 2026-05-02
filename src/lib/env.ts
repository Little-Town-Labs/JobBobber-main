import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

/**
 * Environment variable validation schema.
 * Build fails immediately if any required variable is absent or invalid.
 * Never use process.env directly — always import from this file.
 *
 * @see data-model.md → Environment Variables
 */
export const env = createEnv({
  /**
   * Server-only variables — never bundled to the client.
   * Access via `env.DATABASE_URL` etc. on the server only.
   */
  server: {
    // Database (NeonDB)
    DATABASE_URL: z.string().url(),
    DATABASE_URL_UNPOOLED: z.string().url().optional(),

    // Clerk (auth)
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_WEBHOOK_SECRET: z.string().min(1),

    // Inngest (async workflows)
    INNGEST_SIGNING_KEY: z.string().min(1),
    INNGEST_EVENT_KEY: z.string().min(1),
    INNGEST_DEV_SERVER_URL: z.string().url().optional(),

    // BYOK encryption (AES-256-GCM)
    ENCRYPTION_KEY: z.string().length(64, "Must be 64 hex chars (32 bytes)"),
    ENCRYPTION_IV_SALT: z.string().min(16, "Must be at least 16 chars for adequate entropy"),

    // Observability
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    // Stripe (billing)
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    STRIPE_PRICE_SEEKER_PRO: z.string().min(1),
    STRIPE_PRICE_EMPLOYER_BUSINESS: z.string().min(1),

    // Upstash Redis (rate limiting)
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

    // Email (Resend)
    RESEND_API_KEY: z.string().optional(),
    NOTIFICATION_FROM_EMAIL: z.string().optional(),

    // Cron job authentication
    CRON_SECRET: z.string().optional(),

    // Vercel Flags
    FLAGS_SECRET: z.string().optional(),
  },

  /**
   * Client-accessible variables — bundled to the browser.
   * All must have NEXT_PUBLIC_ prefix.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().min(1),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().min(1),

    // Sentry (optional — client DSN is public)
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

    // Analytics (optional)
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  },

  /**
   * Maps process.env to the validated schema.
   * Destructuring here makes every variable explicit and tree-shakeable.
   */
  runtimeEnv: {
    DATABASE_URL: process.env["DATABASE_URL"],
    DATABASE_URL_UNPOOLED: process.env["DATABASE_URL_UNPOOLED"],
    CLERK_SECRET_KEY: process.env["CLERK_SECRET_KEY"],
    CLERK_WEBHOOK_SECRET: process.env["CLERK_WEBHOOK_SECRET"],
    INNGEST_SIGNING_KEY: process.env["INNGEST_SIGNING_KEY"],
    INNGEST_EVENT_KEY: process.env["INNGEST_EVENT_KEY"],
    INNGEST_DEV_SERVER_URL: process.env["INNGEST_DEV_SERVER_URL"],
    ENCRYPTION_KEY: process.env["ENCRYPTION_KEY"],
    ENCRYPTION_IV_SALT: process.env["ENCRYPTION_IV_SALT"],
    SENTRY_DSN: process.env["SENTRY_DSN"],
    SENTRY_AUTH_TOKEN: process.env["SENTRY_AUTH_TOKEN"],
    STRIPE_SECRET_KEY: process.env["STRIPE_SECRET_KEY"],
    STRIPE_WEBHOOK_SECRET: process.env["STRIPE_WEBHOOK_SECRET"],
    STRIPE_PRICE_SEEKER_PRO: process.env["STRIPE_PRICE_SEEKER_PRO"],
    STRIPE_PRICE_EMPLOYER_BUSINESS: process.env["STRIPE_PRICE_EMPLOYER_BUSINESS"],
    UPSTASH_REDIS_REST_URL: process.env["UPSTASH_REDIS_REST_URL"],
    UPSTASH_REDIS_REST_TOKEN: process.env["UPSTASH_REDIS_REST_TOKEN"],
    RESEND_API_KEY: process.env["RESEND_API_KEY"],
    NOTIFICATION_FROM_EMAIL: process.env["NOTIFICATION_FROM_EMAIL"],
    CRON_SECRET: process.env["CRON_SECRET"],
    FLAGS_SECRET: process.env["FLAGS_SECRET"],
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"],
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"],
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"],
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"],
    NEXT_PUBLIC_SENTRY_DSN: process.env["NEXT_PUBLIC_SENTRY_DSN"],
    NEXT_PUBLIC_POSTHOG_KEY: process.env["NEXT_PUBLIC_POSTHOG_KEY"],
    NEXT_PUBLIC_POSTHOG_HOST: process.env["NEXT_PUBLIC_POSTHOG_HOST"],
  },

  /**
   * Skips validation in CI when only checking types (not running the app).
   * Also skips in test mode — tests set up their own env vars per test.
   */
  skipValidation: process.env["SKIP_ENV_VALIDATION"] === "true",
})
