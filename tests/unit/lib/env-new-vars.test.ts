/**
 * Task 0.3 — env.ts new variables tests (TDD RED phase)
 *
 * Verifies that newly added required/optional env vars are validated at startup.
 * Extends existing env.test.ts without modifying it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost/testdb",
  CLERK_SECRET_KEY: "sk_test_abc123",
  CLERK_WEBHOOK_SECRET: "whsec_test",
  INNGEST_SIGNING_KEY: "signkey-test",
  INNGEST_EVENT_KEY: "eventkey-test",
  ENCRYPTION_KEY: "a".repeat(64),
  ENCRYPTION_IV_SALT: "test-salt-value-ok",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/dashboard",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/onboarding/role",
  // New required vars
  STRIPE_SECRET_KEY: "sk_test_stripe",
  STRIPE_WEBHOOK_SECRET: "whsec_stripe_test",
  UPSTASH_REDIS_REST_URL: "https://fake.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "fake-upstash-token",
  STRIPE_PRICE_SEEKER_PRO: "price_seeker_pro_test",
  STRIPE_PRICE_EMPLOYER_BUSINESS: "price_employer_biz_test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
}

describe("env.ts — new variables", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env["SKIP_ENV_VALIDATION"]
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("exports STRIPE_SECRET_KEY when present", async () => {
    process.env = { ...BASE_ENV }
    const { env } = await import("@/lib/env")
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_stripe")
  })

  it("throws when STRIPE_SECRET_KEY is absent", async () => {
    process.env = { ...BASE_ENV }
    delete process.env["STRIPE_SECRET_KEY"]
    await expect(import("@/lib/env")).rejects.toThrow()
  })

  it("exports STRIPE_WEBHOOK_SECRET when present", async () => {
    process.env = { ...BASE_ENV }
    const { env } = await import("@/lib/env")
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("whsec_stripe_test")
  })

  it("throws when STRIPE_WEBHOOK_SECRET is absent", async () => {
    process.env = { ...BASE_ENV }
    delete process.env["STRIPE_WEBHOOK_SECRET"]
    await expect(import("@/lib/env")).rejects.toThrow()
  })

  it("exports UPSTASH_REDIS_REST_URL and TOKEN when present", async () => {
    process.env = { ...BASE_ENV }
    const { env } = await import("@/lib/env")
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://fake.upstash.io")
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBe("fake-upstash-token")
  })

  it("throws when UPSTASH_REDIS_REST_URL is absent", async () => {
    process.env = { ...BASE_ENV }
    delete process.env["UPSTASH_REDIS_REST_URL"]
    await expect(import("@/lib/env")).rejects.toThrow()
  })

  it("exports STRIPE_PRICE_SEEKER_PRO when present", async () => {
    process.env = { ...BASE_ENV }
    const { env } = await import("@/lib/env")
    expect(env.STRIPE_PRICE_SEEKER_PRO).toBe("price_seeker_pro_test")
  })

  it("throws when STRIPE_PRICE_SEEKER_PRO is absent", async () => {
    process.env = { ...BASE_ENV }
    delete process.env["STRIPE_PRICE_SEEKER_PRO"]
    await expect(import("@/lib/env")).rejects.toThrow()
  })

  it("exports NEXT_PUBLIC_APP_URL when present", async () => {
    process.env = { ...BASE_ENV }
    const { env } = await import("@/lib/env")
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000")
  })

  it("exports RESEND_API_KEY and CRON_SECRET as optional", async () => {
    process.env = { ...BASE_ENV }
    const { env } = await import("@/lib/env")
    // Optional vars absent → undefined, not a throw
    expect(env.RESEND_API_KEY).toBeUndefined()
    expect(env.CRON_SECRET).toBeUndefined()
  })
})
