/**
 * Task 1.2 — REST integration test harness smoke tests (TDD RED phase).
 *
 * Validates that:
 * 1. The rest-client helper can call the v1 route handler directly
 * 2. GET /health returns { status: "ok" } with HTTP 200
 * 3. The helper correctly injects Authorization headers
 * 4. Unknown routes return 404
 */
import { describe, it, expect, vi, beforeAll } from "vitest"

// Cold-start: importing the full appRouter (19 routers) takes ~8-15s on WSL2.
// hookTimeout covers beforeAll; testTimeout covers individual tests.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("@/lib/flags", () => ({
  PUBLIC_API: () => true,
}))
// appRouter transitively imports billing router → stripe. Mock to avoid env validation.
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ invoices: { list: vi.fn() } }) }))
vi.mock("@/lib/stripe-sessions", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))
// Mock rate limiter to avoid real Redis calls in tests.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: 0,
  }),
  rateLimitHeaders: vi.fn().mockReturnValue({
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
    "X-RateLimit-Reset": "0",
  }),
}))

import { callV1, callV1Authed } from "tests/helpers/rest-client"

// Warm up the handler before tests run so cold-start doesn't hit individual timeouts
beforeAll(async () => {
  await callV1("GET", "/health")
}, 60_000)

describe("GET /api/v1/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await callV1("GET", "/health")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(typeof body.timestamp).toBe("string")
  })

  it("callV1Authed injects Authorization header", async () => {
    const res = await callV1Authed("GET", "/health", "test-api-key")
    expect(res.status).toBe(200)
  })

  it("unknown route returns 404", async () => {
    const res = await callV1("GET", "/nonexistent-route-xyz")
    expect(res.status).toBe(404)
  })
})

describe("GET /api/v1/health/deep", () => {
  it("returns healthy:true when db responds", async () => {
    const res = await callV1("GET", "/health/deep")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.healthy).toBe(true)
    expect(Array.isArray(body.checks)).toBe(true)
  })
})

describe("response headers", () => {
  it("includes X-JobBobber-Request-Id as a UUID on every response", async () => {
    const res = await callV1("GET", "/health")
    const requestId = res.headers.get("X-JobBobber-Request-Id")
    expect(requestId).not.toBeNull()
    // UUID v4 shape: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it("returns a distinct X-JobBobber-Request-Id per request", async () => {
    const [res1, res2] = await Promise.all([callV1("GET", "/health"), callV1("GET", "/health")])
    expect(res1.headers.get("X-JobBobber-Request-Id")).not.toBe(
      res2.headers.get("X-JobBobber-Request-Id"),
    )
  })

  it("includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers", async () => {
    const res = await callV1("GET", "/health")
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100")
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99")
    expect(res.headers.get("X-RateLimit-Reset")).toBe("0")
  })
})
