/**
 * T1.2T — Environment validation tests
 * These tests validate that src/lib/env.ts correctly enforces required env vars.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("env validation", () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset modules before each test so env.ts re-evaluates
    vi.resetModules()
    process.env = { ...originalEnv }
    // Ensure validation runs even when CI sets SKIP_ENV_VALIDATION=true
    delete process.env["SKIP_ENV_VALIDATION"]
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("exports a valid env object when all required variables are present", async () => {
    process.env["DATABASE_URL"] = "postgresql://test:test@localhost/testdb"
    process.env["DATABASE_URL_UNPOOLED"] = "postgresql://test:test@localhost/testdb"
    process.env["CLERK_SECRET_KEY"] = "sk_test_abc123"
    process.env["CLERK_WEBHOOK_SECRET"] = "whsec_test"
    process.env["INNGEST_SIGNING_KEY"] = "signkey-test"
    process.env["INNGEST_EVENT_KEY"] = "eventkey-test"
    process.env["ENCRYPTION_KEY"] = "a".repeat(64)
    process.env["ENCRYPTION_IV_SALT"] = "test-salt-value-ok"
    // Stripe (api-only-pivot: Task 0.4)
    process.env["STRIPE_SECRET_KEY"] = "sk_test_stripe"
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_stripe_test"
    process.env["STRIPE_PRICE_SEEKER_PRO"] = "price_seeker_pro_test"
    process.env["STRIPE_PRICE_EMPLOYER_BUSINESS"] = "price_employer_biz_test"
    // Upstash (api-only-pivot: Task 0.4)
    process.env["UPSTASH_REDIS_REST_URL"] = "https://fake.upstash.io"
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "fake-upstash-token"
    process.env["NEXT_PUBLIC_APP_URL"] = "http://localhost:3000"
    process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] = "pk_test_abc"
    process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"] = "/sign-in"
    process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"] = "/sign-up"
    process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"] = "/dashboard"
    process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"] = "/onboarding/role"

    const { env } = await import("@/lib/env")
    expect(env.DATABASE_URL).toBe("postgresql://test:test@localhost/testdb")
    expect(env.CLERK_SECRET_KEY).toBe("sk_test_abc123")
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_stripe")
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://fake.upstash.io")
    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_test_abc")
  })

  it("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)", async () => {
    process.env["DATABASE_URL"] = "postgresql://test:test@localhost/testdb"
    process.env["DATABASE_URL_UNPOOLED"] = "postgresql://test:test@localhost/testdb"
    process.env["CLERK_SECRET_KEY"] = "sk_test_abc123"
    process.env["CLERK_WEBHOOK_SECRET"] = "whsec_test"
    process.env["INNGEST_SIGNING_KEY"] = "signkey-test"
    process.env["INNGEST_EVENT_KEY"] = "eventkey-test"
    process.env["ENCRYPTION_KEY"] = "tooshort" // invalid
    process.env["ENCRYPTION_IV_SALT"] = "test-salt-value-ok"
    process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] = "pk_test_abc"
    process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"] = "/sign-in"
    process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"] = "/sign-up"
    process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"] = "/dashboard"
    process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"] = "/onboarding/role"

    await expect(import("@/lib/env")).rejects.toThrow()
  })
})

describe("sanity", () => {
  it("test infrastructure is working", () => {
    expect(1 + 1).toBe(2)
  })
})
