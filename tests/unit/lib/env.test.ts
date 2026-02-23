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
    process.env["ENCRYPTION_KEY"] = "a".repeat(64) // 64 hex chars = 32 bytes
    process.env["ENCRYPTION_IV_SALT"] = "test-salt-value"
    process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] = "pk_test_abc"
    process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"] = "/sign-in"
    process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"] = "/sign-up"
    process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"] = "/dashboard"
    process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"] = "/onboarding/role"

    const { env } = await import("@/lib/env")
    expect(env.DATABASE_URL).toBe("postgresql://test:test@localhost/testdb")
    expect(env.CLERK_SECRET_KEY).toBe("sk_test_abc123")
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
    process.env["ENCRYPTION_IV_SALT"] = "test-salt-value"
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
