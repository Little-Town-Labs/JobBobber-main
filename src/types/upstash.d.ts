/** Minimal type stubs for @upstash packages (dynamically imported at runtime) */

declare module "@upstash/redis" {
  export class Redis {
    constructor(opts: { url: string; token: string })
  }
}

declare module "@upstash/ratelimit" {
  import type { Redis } from "@upstash/redis"

  interface RateLimitResult {
    success: boolean
    limit: number
    remaining: number
    reset: number
  }

  export class Ratelimit {
    constructor(opts: { redis: Redis; limiter: unknown; prefix?: string })
    limit(identifier: string): Promise<RateLimitResult>
    static slidingWindow(requests: number, window: string): unknown
  }
}
