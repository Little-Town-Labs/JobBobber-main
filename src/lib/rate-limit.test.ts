import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

const mockLimit = vi.fn()
const mockSlidingWindow = vi.fn().mockReturnValue("sliding-window-config")

class MockRatelimit {
  constructor(public opts: Record<string, unknown>) {
    MockRatelimit._lastInstance = this
    MockRatelimit._constructorCalls.push(opts)
  }
  limit = mockLimit
  static slidingWindow = mockSlidingWindow
  static _lastInstance: MockRatelimit | null = null
  static _constructorCalls: Record<string, unknown>[] = []
}

class MockRedis {
  constructor(public opts: Record<string, unknown>) {}
}

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: MockRatelimit,
}))

vi.mock("@upstash/redis", () => ({
  Redis: MockRedis,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockRatelimit._constructorCalls = []
    MockRatelimit._lastInstance = null
    process.env["UPSTASH_REDIS_REST_URL"] = "https://redis.example.com"
    process.env["UPSTASH_REDIS_REST_TOKEN"] = "test-token"
  })

  afterEach(() => {
    delete process.env["UPSTASH_REDIS_REST_URL"]
    delete process.env["UPSTASH_REDIS_REST_TOKEN"]
  })

  it("allows requests under limit (success: true)", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 95,
      reset: 1700000000,
    })

    const { checkRateLimit } = await import("@/lib/rate-limit")
    const result = await checkRateLimit("user_123", "read")

    expect(result).toEqual({
      success: true,
      limit: 100,
      remaining: 95,
      reset: 1700000000,
    })
    expect(mockLimit).toHaveBeenCalledWith("user_123")
  })

  it("blocks requests exceeding limit (success: false)", async () => {
    mockLimit.mockResolvedValue({
      success: false,
      limit: 20,
      remaining: 0,
      reset: 1700000060,
    })

    const { checkRateLimit } = await import("@/lib/rate-limit")
    const result = await checkRateLimit("user_456", "auth")

    expect(result).toEqual({
      success: false,
      limit: 20,
      remaining: 0,
      reset: 1700000060,
    })
  })

  it("uses correct config for different categories", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1700000000,
    })

    const { checkRateLimit } = await import("@/lib/rate-limit")
    await checkRateLimit("user_789", "agent")

    expect(MockRatelimit._constructorCalls).toHaveLength(1)
    expect(MockRatelimit._constructorCalls[0]).toEqual(
      expect.objectContaining({
        prefix: "rl:agent",
      }),
    )
    expect(mockSlidingWindow).toHaveBeenCalledWith(10, "1m")
  })

  it("fails open when env vars not set", async () => {
    delete process.env["UPSTASH_REDIS_REST_URL"]
    delete process.env["UPSTASH_REDIS_REST_TOKEN"]

    const { checkRateLimit } = await import("@/lib/rate-limit")
    const result = await checkRateLimit("user_123", "write")

    expect(result).toEqual({
      success: true,
      limit: 30,
      remaining: 30,
      reset: 0,
    })
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it("fails open when Redis throws", async () => {
    mockLimit.mockRejectedValue(new Error("Redis connection failed"))
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { checkRateLimit } = await import("@/lib/rate-limit")
    const result = await checkRateLimit("user_123", "read")

    expect(result).toEqual({
      success: true,
      limit: 100,
      remaining: 100,
      reset: 0,
    })
    expect(warnSpy).toHaveBeenCalledWith(
      "Rate limiter unavailable, failing open:",
      expect.any(Error),
    )

    warnSpy.mockRestore()
  })
})

describe("RATE_LIMIT_CATEGORIES", () => {
  it("defines different limits for different categories", async () => {
    const { RATE_LIMIT_CATEGORIES } = await import("@/lib/rate-limit")

    expect(RATE_LIMIT_CATEGORIES.auth.requests).toBe(20)
    expect(RATE_LIMIT_CATEGORIES.read.requests).toBe(100)
    expect(RATE_LIMIT_CATEGORIES.write.requests).toBe(30)
    expect(RATE_LIMIT_CATEGORIES.agent.requests).toBe(10)
    expect(RATE_LIMIT_CATEGORIES.webhook.requests).toBe(200)
  })
})

describe("rateLimitHeaders", () => {
  it("returns correct header format", async () => {
    const { rateLimitHeaders } = await import("@/lib/rate-limit")

    const headers = rateLimitHeaders({
      success: true,
      limit: 100,
      remaining: 95,
      reset: 1700000000,
    })

    expect(headers).toEqual({
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "95",
      "X-RateLimit-Reset": "1700000000",
    })
  })

  it("converts numeric values to strings", async () => {
    const { rateLimitHeaders } = await import("@/lib/rate-limit")

    const headers = rateLimitHeaders({
      success: false,
      limit: 20,
      remaining: 0,
      reset: 0,
    })

    expect(headers["X-RateLimit-Limit"]).toBe("20")
    expect(headers["X-RateLimit-Remaining"]).toBe("0")
    expect(headers["X-RateLimit-Reset"]).toBe("0")
  })
})
