/**
 * Zod schemas for feedback insight generation.
 *
 * - InsightGenerationInput: aggregated statistics fed to the LLM (privacy-safe)
 * - InsightGenerationOutput: structured LLM response validated before storage
 */
import { z } from "zod"

/** Schema for aggregated statistics passed to the LLM prompt */
export const insightGenerationInputSchema = z.object({
  userType: z.enum(["JOB_SEEKER", "EMPLOYER"]),
  totalConversations: z.number().int().min(0),
  completedMatchCount: z.number().int().min(0),
  completedNoMatchCount: z.number().int().min(0),
  terminatedCount: z.number().int().min(0),
  inProgressCount: z.number().int().min(0),
  matchRate: z.number().min(0).max(1),
  acceptanceRate: z.number().min(0).max(1),
  confidenceDistribution: z.object({
    STRONG: z.number().int().min(0),
    GOOD: z.number().int().min(0),
    POTENTIAL: z.number().int().min(0),
  }),
  recentOutcomes: z.array(z.enum(["MATCH", "NO_MATCH", "TERMINATED"])).max(5),
  overallMatchRate: z.number().min(0).max(1),
  recentMatchRate: z.number().min(0).max(1),
  patternSummaries: z.array(z.string().max(500)).max(10),
})

export type InsightGenerationInput = z.infer<typeof insightGenerationInputSchema>

/** Schema for validated LLM output — stored in FeedbackInsights */
export const insightGenerationOutputSchema = z.object({
  strengths: z.array(z.string().max(200)).min(1).max(5),
  weaknesses: z.array(z.string().max(200)).min(1).max(5),
  recommendations: z.array(z.string().max(300)).min(1).max(5),
})

export type InsightGenerationOutput = z.infer<typeof insightGenerationOutputSchema>

/** Minimum completed conversations before insights can be generated */
export const INSIGHT_GENERATION_THRESHOLD = 3

/** Number of new conversations before automatic regeneration */
export const INSIGHT_REGENERATION_DELTA = 3

/** Manual refresh rate limit in milliseconds (1 hour) */
export const INSIGHT_REFRESH_RATE_LIMIT_MS = 60 * 60 * 1000

/** Maximum conversations to analyze for pattern extraction */
export const MAX_CONVERSATIONS_FOR_PATTERNS = 50

/** Number of recent outcomes for trend calculation */
export const RECENT_WINDOW_SIZE = 5
