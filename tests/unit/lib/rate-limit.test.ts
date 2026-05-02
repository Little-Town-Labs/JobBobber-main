/**
 * Task 0.1 — Rate limit tests
 *
 * Uses vi.hoisted() so the shared mockLimitFn is available inside the vi.mock
 * factory (which Vitest hoists above imports). This avoids the stale-mock-instance
 * problem that occurs when configuring constructor mocks per-test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { checkRateLimit, rateLimitHeaders, _resetRateLimiterCache } from "@/lib/rate-limit"

// vi.hoisted runs before vi.mock factories and before imports, so mockLimitFn
// is available when the Ratelimit factory closes over it.
const { mockLimitFn, MockRatelimit } = vi.hoisted(() => {
  const mockLimitFn = vi.fn()
  // Must be a regular function (not arrow) so `new Ratelimit()` works in rate-limit.ts
  const MockRatelimit = vi.fn(function MockRatelimitCtor() {
    return { limit: mockLimitFn }
  })
  // @ts-expect-error — static method on mock constructor
  MockRatelimit.slidingWindow = vi.fn().mockReturnValue("sliding-window-config")
  return { mockLimitFn, MockRatelimit }
})

vi.mock("@upstash/ratelimit", () => ({ Ratelimit: MockRatelimit }))
vi.mock("@upstash/redis", () => ({ Redis: vi.fn() }))

describe("checkRateLimit", () => {
  const originalEnv = process.env

  beforeEach(() => {
    mockLimitFn.mockReset()
    MockRatelimit.mockClear()
    _resetRateLimiterCache()
    process.env = { ...originalEnv }
    delete process.env["UPSTASH_REDIS_REST_URL"]
    delete process.env["UPSTASH_REDIS_REST_TOKEN"]
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("returns success:true when Upstash credentials are absent (fail open for dev)", async () => {
    const result = await checkRateLimit("user_123", "read")
    expect(result.success).toBe(true)
    expect(result.limit).toBeGreaterThan(0)
  })

  it("returns success:false when Redis throws (fail closed — not fail open)", async () => {
    process.env["UPSTASH_REDIS_REST_URL"] = "https://fake.upstash.io"
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "fake-token"
    mockLimitFn.mockRejectedValue(new Error("Redis connection refused"))

    const result = await checkRateLimit("user_123", "read")

    expect(result.success).toBe(false)
  })

  it("returns the Upstash result on a successful check", async () => {
    process.env["UPSTASH_REDIS_REST_URL"] = "https://fake.upstash.io"
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "fake-token"
    mockLimitFn.mockResolvedValue({ success: true, limit: 100, remaining: 97, reset: 9999 })

    const result = await checkRateLimit("user_123", "read")

    expect(result.success).toBe(true)
    expect(result.limit).toBe(100)
    expect(result.remaining).toBe(97)
    expect(result.reset).toBe(9999)
  })

  it("returns success:false when the rate limit is exceeded", async () => {
    process.env["UPSTASH_REDIS_REST_URL"] = "https://fake.upstash.io"
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "fake-token"
    mockLimitFn.mockResolvedValue({ success: false, limit: 100, remaining: 0, reset: 9999 })

    const result = await checkRateLimit("user_123", "read")

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.reset).toBe(9999)
  })

  it("caches the Ratelimit instance (constructor called once per category)", async () => {
    process.env["UPSTASH_REDIS_REST_URL"] = "https://fake.upstash.io"
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "fake-token"
    mockLimitFn.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 9999 })

    await checkRateLimit("user_1", "read")
    await checkRateLimit("user_2", "read")

    expect(MockRatelimit).toHaveBeenCalledTimes(1)
  })
})

describe("rateLimitHeaders", () => {
  it("returns correctly named headers with string values", () => {
    const headers = rateLimitHeaders({ success: true, limit: 100, remaining: 97, reset: 9999 })

    expect(headers["X-RateLimit-Limit"]).toBe("100")
    expect(headers["X-RateLimit-Remaining"]).toBe("97")
    expect(headers["X-RateLimit-Reset"]).toBe("9999")
  })
})
