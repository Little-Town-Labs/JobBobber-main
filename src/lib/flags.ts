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
  decide: () => false,
})

export const EMPLOYER_PROFILE = flag<boolean>({
  key: "employer-profile",
  defaultValue: false,
  description: "Enable employer org profile onboarding and editing (Feature 3)",
  decide: () => false,
})

export const AI_MATCHING = flag<boolean>({
  key: "ai-matching",
  defaultValue: false,
  description: "Enable AI agent-to-agent matching conversations (Feature 6)",
  decide: () => false,
})

export const MATCH_DASHBOARD = flag<boolean>({
  key: "match-dashboard",
  defaultValue: false,
  description: "Enable match review dashboard for seekers and employers (Feature 7)",
  decide: () => false,
})

export const FEEDBACK_INSIGHTS = flag<boolean>({
  key: "feedback-insights",
  defaultValue: false,
  description: "Enable AI-generated aggregate feedback insights (Feature 14)",
  decide: () => false,
})

export const AGENT_CONVERSATIONS = flag<boolean>({
  key: "agent-conversations",
  defaultValue: false,
  description: "Enable multi-turn agent-to-agent conversations for matching (Feature 9)",
  decide: () => false,
})

export const VECTOR_SEARCH = flag<boolean>({
  key: "vector-search",
  defaultValue: false,
  description: "Enable pgvector semantic search for candidate shortlisting (Feature 11)",
  decide: () => false,
})

export const CONVERSATION_LOGS = flag<boolean>({
  key: "conversation-logs",
  defaultValue: false,
  description: "Enable read-only conversation log viewing in dashboards (Feature 12)",
  decide: () => false,
})

export const MULTI_MEMBER_EMPLOYER = flag<boolean>({
  key: "multi-member-employer",
  defaultValue: false,
  description: "Enable multi-member employer accounts with role-based access (Feature 13)",
  decide: () => false,
})

export const PRIVATE_PARAMS = flag<boolean>({
  key: "private-params",
  defaultValue: false,
  description: "Enable private negotiation parameters for seekers and employers (Feature 8)",
  decide: () => false,
})

export const CUSTOM_PROMPTS = flag<boolean>({
  key: "custom-prompts",
  defaultValue: false,
  description: "Enable custom agent prompting with injection detection (Feature 15)",
  decide: () => false,
})

export const SUBSCRIPTION_BILLING = flag<boolean>({
  key: "subscription-billing",
  defaultValue: false,
  description: "Enable subscription billing with tiered plans (Feature 16)",
  decide: () => false,
})

export const COMPLIANCE_SECURITY = flag<boolean>({
  key: "compliance-security",
  defaultValue: false,
  description:
    "Enable compliance and security features: GDPR export/deletion, rate limiting, audit logging (Feature 18)",
  decide: () => false,
})

export const USER_CHAT = flag<boolean>({
  key: "user-chat",
  defaultValue: false,
  description: "Enable user-to-agent chat interface (Feature 19)",
  decide: () => false,
})

export const ADVANCED_EMPLOYER_DASHBOARD = flag<boolean>({
  key: "advanced-employer-dashboard",
  defaultValue: false,
  description:
    "Enable advanced employer dashboard with pipeline view, comparison, and bulk ops (Feature 17)",
  decide: () => false,
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
