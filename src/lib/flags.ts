import { flag } from "@vercel/flags/next"
import { TRPCError } from "@trpc/server"

/**
 * Platform feature flags.
 *
 * All flags default to `false` — features are OFF until explicitly enabled
 * in the Vercel Flags dashboard or via environment overrides.
 *
 * Usage in tRPC procedures:
 *   await assertFlagEnabled(SEEKER_PROFILE)  // throws NOT_FOUND if off
 *
 * @see contracts/trpc-api.ts for which procedures gate on which flags
 */

export const SEEKER_PROFILE = flag<boolean>({
  key: "seeker-profile",
  defaultValue: false,
  description: "Enable seeker profile onboarding and editing (Feature 2)",
})

export const EMPLOYER_PROFILE = flag<boolean>({
  key: "employer-profile",
  defaultValue: false,
  description: "Enable employer org profile onboarding and editing (Feature 3)",
})

export const AI_MATCHING = flag<boolean>({
  key: "ai-matching",
  defaultValue: false,
  description: "Enable AI agent-to-agent matching conversations (Feature 6)",
})

export const MATCH_DASHBOARD = flag<boolean>({
  key: "match-dashboard",
  defaultValue: false,
  description: "Enable match review dashboard for seekers and employers (Feature 7)",
})

export const FEEDBACK_INSIGHTS = flag<boolean>({
  key: "feedback-insights",
  defaultValue: false,
  description: "Enable AI-generated feedback insights panel (Feature 9)",
})

export const PRIVATE_PARAMS = flag<boolean>({
  key: "private-params",
  defaultValue: false,
  description: "Enable private negotiation parameters for seekers and employers (Feature 8)",
})

/**
 * Assert that a feature flag is enabled.
 * Throws `TRPCError({ code: "NOT_FOUND" })` if the flag is off.
 *
 * Use at the top of a tRPC procedure body — not as middleware —
 * because flags are procedure-specific, not role-specific.
 *
 * @example
 *   getMyInsights: seekerProcedure.query(async () => {
 *     await assertFlagEnabled(FEEDBACK_INSIGHTS)
 *     // ... implementation
 *   })
 */
export async function assertFlagEnabled(flagFn: () => boolean | Promise<boolean>): Promise<void> {
  const enabled = await flagFn()
  if (!enabled) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This feature is not yet available.",
    })
  }
}
