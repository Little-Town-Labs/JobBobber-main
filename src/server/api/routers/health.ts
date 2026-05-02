import { z } from "zod"
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc"

export const healthRouter = createTRPCRouter({
  ping: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/health",
        summary: "Health check",
        tags: ["system"],
      },
    })
    .input(z.void())
    .output(
      z.object({
        status: z.literal("ok"),
        timestamp: z.string(),
      }),
    )
    .query((): { status: "ok"; timestamp: string } => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    })),

  deepCheck: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/health/deep",
        summary: "Deep health check",
        tags: ["system"],
      },
    })
    .input(z.void())
    .output(
      z.object({
        healthy: z.boolean(),
        timestamp: z.string(),
        checks: z.array(
          z.object({
            name: z.string(),
            status: z.enum(["ok", "unreachable"]),
            latencyMs: z.number(),
          }),
        ),
      }),
    )
    .query(async ({ ctx }) => {
      const timestamp = new Date().toISOString()
      const checks: Array<{ name: string; status: "ok" | "unreachable"; latencyMs: number }> = []

      const dbStart = Date.now()
      try {
        await ctx.db.$queryRaw`SELECT 1`
        checks.push({ name: "database", status: "ok", latencyMs: Date.now() - dbStart })
      } catch {
        checks.push({ name: "database", status: "unreachable", latencyMs: Date.now() - dbStart })
      }

      return { healthy: checks.every((c) => c.status === "ok"), checks, timestamp }
    }),
})
