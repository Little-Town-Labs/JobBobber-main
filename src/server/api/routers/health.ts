import { createTRPCRouter, publicProcedure } from "@/server/api/trpc"
import type { HealthDeepCheckOutput, HealthPingOutput } from "@/types/trpc"

/**
 * Health router — infrastructure liveness and readiness checks.
 *
 * Both procedures are public (no authentication required).
 *
 * @see contracts/trpc-api.ts (HealthPingOutput, HealthDeepCheckOutput)
 */
export const healthRouter = createTRPCRouter({
  /** Lightweight liveness probe — always returns ok if the server is up. */
  ping: publicProcedure.query((): HealthPingOutput => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    }
  }),

  /**
   * Deep readiness probe — checks database connectivity.
   * Returns healthy=false (not a thrown error) so callers can inspect checks.
   */
  deepCheck: publicProcedure.query(async ({ ctx }): Promise<HealthDeepCheckOutput> => {
    const timestamp = new Date().toISOString()
    const checks: HealthDeepCheckOutput["checks"] = []

    // Database check
    const dbStart = Date.now()
    try {
      await ctx.db.$queryRaw`SELECT 1`
      checks.push({
        name: "database",
        status: "ok",
        latencyMs: Date.now() - dbStart,
      })
    } catch {
      checks.push({
        name: "database",
        status: "unreachable",
        latencyMs: Date.now() - dbStart,
      })
    }

    const healthy = checks.every((c) => c.status === "ok")

    return { healthy, checks, timestamp }
  }),
})
