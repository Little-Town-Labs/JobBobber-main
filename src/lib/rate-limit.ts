import "server-only"

/** Rate limit categories with requests per minute */
export const RATE_LIMIT_CATEGORIES = {
  auth: { requests: 20, window: "1m" },
  read: { requests: 100, window: "1m" },
  write: { requests: 30, window: "1m" },
  agent: { requests: 10, window: "1m" },
  chat: { requests: 10, window: "1m" },
  webhook: { requests: 200, window: "1m" },
} as const

export type RateLimitCategory = keyof typeof RATE_LIMIT_CATEGORIES

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // unix timestamp
}

// Cached Ratelimit instances per category to avoid creating new Redis connections per call.
// Note: cache does not invalidate on credential rotation — acceptable for serverless
// (short-lived processes). A process restart picks up new credentials.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rateLimiterCache = new Map<RateLimitCategory, any>()

/** Reset cached rate limiter instances (test use only). */
export function _resetRateLimiterCache() {
  rateLimiterCache.clear()
}

/**
 * Check rate limit for a given identifier and category.
 * Falls open if Redis is unavailable (logs warning, allows request).
 */
export async function checkRateLimit(
  identifier: string,
  category: RateLimitCategory,
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CATEGORIES[category]

  // If Upstash env vars not configured, fail open
  const url = process.env["UPSTASH_REDIS_REST_URL"]
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"]
  if (!url || !token) {
    return { success: true, limit: config.requests, remaining: config.requests, reset: 0 }
  }

  try {
    let ratelimit = rateLimiterCache.get(category)
    if (!ratelimit) {
      const { Ratelimit } = await import("@upstash/ratelimit")
      const { Redis } = await import("@upstash/redis")

      const redis = new Redis({ url, token })
      ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        prefix: `rl:${category}`,
      })
      rateLimiterCache.set(category, ratelimit)
    }

    const result = await ratelimit.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    console.warn("Rate limiter unavailable, failing open:", error)
    return { success: true, limit: config.requests, remaining: config.requests, reset: 0 }
  }
}

/**
 * Build standard rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  }
}
