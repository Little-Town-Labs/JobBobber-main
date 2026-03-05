/**
 * Zod schemas and types for AI matching evaluation.
 *
 * Used by the Employer Agent to validate structured LLM output
 * and by the matches router for response mapping.
 *
 * @see .specify/specs/5-basic-ai-matching/contracts/matching-types.ts
 */
import { z } from "zod"

// ---------------------------------------------------------------------------
// Agent Evaluation Schema (LLM output validation)
// ---------------------------------------------------------------------------

export const agentEvaluationSchema = z.object({
  score: z.number().int().min(0).max(100),
  confidence: z.enum(["STRONG", "GOOD", "POTENTIAL"]),
  matchSummary: z.string().min(20).max(1000),
  strengthAreas: z.array(z.string().max(200)).min(1).max(10),
  gapAreas: z.array(z.string().max(200)).max(10),
})

export type AgentEvaluation = z.infer<typeof agentEvaluationSchema>

// ---------------------------------------------------------------------------
// Score → Confidence mapping
// ---------------------------------------------------------------------------

export function scoreToConfidence(score: number): "STRONG" | "GOOD" | "POTENTIAL" | null {
  if (score >= 70) return "STRONG"
  if (score >= 50) return "GOOD"
  if (score >= 30) return "POTENTIAL"
  return null
}

// ---------------------------------------------------------------------------
// Match threshold
// ---------------------------------------------------------------------------

export const MATCH_SCORE_THRESHOLD = 30
