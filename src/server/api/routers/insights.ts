import { createTRPCRouter, seekerProcedure, employerProcedure } from "@/server/api/trpc"
import { TRPCError } from "@trpc/server"

/**
 * Insights router — AI-generated feedback aggregates.
 *
 * Gated behind the FEEDBACK_INSIGHTS feature flag.
 * Never exposes raw conversation data — computed aggregates only.
 * TODO: implement in Feature 9 (feedback & insights).
 */
export const insightsRouter = createTRPCRouter({
  /**
   * Get the seeker's aggregate feedback insights.
   * Requires FEEDBACK_INSIGHTS feature flag to be enabled.
   * TODO: implement in Feature 9
   */
  getMyInsights: seekerProcedure.query(async () => {
    // Feature flag gate — replace with real flag check in Feature 9
    const flagEnabled = process.env["NEXT_PUBLIC_FLAG_FEEDBACK_INSIGHTS"] === "true"
    if (!flagEnabled) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Insights feature is not yet available.",
      })
    }
    // TODO: implement in Feature 9
    return null
  }),

  /**
   * Get the employer's aggregate feedback insights.
   * Requires FEEDBACK_INSIGHTS feature flag to be enabled.
   * TODO: implement in Feature 9
   */
  getEmployerInsights: employerProcedure.query(async () => {
    const flagEnabled = process.env["NEXT_PUBLIC_FLAG_FEEDBACK_INSIGHTS"] === "true"
    if (!flagEnabled) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Insights feature is not yet available.",
      })
    }
    // TODO: implement in Feature 9
    return null
  }),
})
