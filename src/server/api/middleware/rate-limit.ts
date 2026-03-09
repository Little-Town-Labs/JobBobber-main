import { TRPCError } from "@trpc/server"
import { checkRateLimit, type RateLimitCategory, type RateLimitResult } from "@/lib/rate-limit"

/**
 * Rate limit check for tRPC procedures.
 * Call at the top of any procedure that needs rate limiting.
 *
 * @param identifier - userId for authenticated, IP for unauthenticated
 * @param category - rate limit category
 * @returns Rate limit result with headers
 * @throws TRPCError with TOO_MANY_REQUESTS if limit exceeded
 */
export async function enforceRateLimit(
  identifier: string,
  category: RateLimitCategory,
): Promise<RateLimitResult> {
  const result = await checkRateLimit(identifier, category)
  if (!result.success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Try again later.",
    })
  }
  return result
}

/**
 * Map a tRPC procedure type to a rate limit category.
 * Useful for generic rate limiting in middleware or utilities.
 */
export function procedureToCategory(
  procedureType: "query" | "mutation" | "subscription",
): RateLimitCategory {
  switch (procedureType) {
    case "query":
      return "read"
    case "mutation":
      return "write"
    case "subscription":
      return "read"
  }
}
