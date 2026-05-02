/**
 * T2.1 — Middleware onboarding gate unit tests
 *
 * Tests the pure `resolveOnboardingRedirect` function extracted from
 * src/middleware.ts. This function contains all the gate decision logic and
 * can be tested without mocking Clerk's middleware wrapper.
 *
 * Test matrix:
 *
 * | Clerk state          | Target path        | Expected                         |
 * | -------------------- | ------------------ | -------------------------------- |
 * | No role              | /welcome           | /onboarding/role                 |
 * | No role              | /onboarding/role   | null (allow)                     |
 * | Role set             | /welcome           | null (allow)                     |
 * | Role set             | /onboarding/role   | /welcome (re-entry prevention)   |
 *
 * Note: The "no session" case (redirect to Clerk sign-in) is handled by
 * Clerk's `auth.protect()` before our gate logic runs — not tested here.
 * Public routes (/api/v1/**, /docs/**) bypass the middleware entirely.
 */
import { describe, it, expect, vi } from "vitest"

// Mock Clerk before importing middleware (middleware.ts imports clerkMiddleware)
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn((_handler: unknown) => _handler),
  createRouteMatcher: vi.fn((patterns: string[]) => (req: { url: string }) => {
    return patterns.some((p) => {
      const regex = new RegExp(p.replace("(.*)", ".*").replace(/\//g, "\\/"))
      return regex.test(new URL(req.url).pathname)
    })
  }),
}))

import { resolveOnboardingRedirect } from "@/middleware"

describe("resolveOnboardingRedirect — Gate 1: no role set", () => {
  it("redirects to /onboarding/role when role is null", () => {
    const result = resolveOnboardingRedirect("/welcome", { role: null })
    expect(result).toBe("/onboarding/role")
  })

  it("redirects to /onboarding/role when role is undefined", () => {
    const result = resolveOnboardingRedirect("/welcome", {})
    expect(result).toBe("/onboarding/role")
  })

  it("allows /onboarding/role itself when no role set (gate destination)", () => {
    const result = resolveOnboardingRedirect("/onboarding/role", { role: null })
    expect(result).toBeNull()
  })

  it("redirects any protected path to /onboarding/role when no role", () => {
    const result = resolveOnboardingRedirect("/account/settings", {})
    expect(result).toBe("/onboarding/role")
  })
})

describe("resolveOnboardingRedirect — role is set", () => {
  it("allows /welcome when role is JOB_SEEKER", () => {
    const result = resolveOnboardingRedirect("/welcome", { role: "JOB_SEEKER" })
    expect(result).toBeNull()
  })

  it("allows /welcome when role is EMPLOYER", () => {
    const result = resolveOnboardingRedirect("/welcome", { role: "EMPLOYER" })
    expect(result).toBeNull()
  })

  it("allows any protected path when role is set", () => {
    const result = resolveOnboardingRedirect("/account/settings", { role: "JOB_SEEKER" })
    expect(result).toBeNull()
  })
})

describe("resolveOnboardingRedirect — re-entry prevention", () => {
  it("redirects /onboarding/role to /welcome if role already set (JOB_SEEKER)", () => {
    const result = resolveOnboardingRedirect("/onboarding/role", { role: "JOB_SEEKER" })
    expect(result).toBe("/welcome")
  })

  it("redirects /onboarding/role to /welcome if role already set (EMPLOYER)", () => {
    const result = resolveOnboardingRedirect("/onboarding/role", { role: "EMPLOYER" })
    expect(result).toBe("/welcome")
  })
})
