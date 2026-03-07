/**
 * Zod schemas and types for AI matching evaluation.
 *
 * Used by the Employer Agent to validate structured LLM output
 * and by the matches router for response mapping.
 *
 * @see .specify/specs/5-basic-ai-matching/contracts/matching-types.ts
 */
import { z } from "zod"
import {
  agentEvaluationSchema as conversationAgentEvaluationSchema,
  type AgentEvaluation as ConversationAgentEvaluation,
} from "./conversation-schemas"

// ---------------------------------------------------------------------------
// Agent Evaluation Schema (Feature 5 — LLM output validation)
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

// ---------------------------------------------------------------------------
// Two-Way Matching Evaluation (Feature 10)
// ---------------------------------------------------------------------------

export const confidenceInputsSchema = z.object({
  averageScore: z.number().min(0).max(100),
  dimensionCount: z.number().int(),
  weakestDimension: z.string(),
  weakestScore: z.number().int().min(0).max(100),
})

export type ConfidenceInputs = z.infer<typeof confidenceInputsSchema>

export const matchEvaluationDataSchema = z.object({
  employerEvaluation: conversationAgentEvaluationSchema,
  seekerEvaluation: conversationAgentEvaluationSchema,
  confidenceInputs: confidenceInputsSchema,
})

export type MatchEvaluationData = z.infer<typeof matchEvaluationDataSchema>

export function computeConfidence(
  employerEvaluation: ConversationAgentEvaluation,
  seekerEvaluation: ConversationAgentEvaluation,
): { confidence: "STRONG" | "GOOD" | "POTENTIAL"; confidenceInputs: ConfidenceInputs } {
  const allDimensions = [...employerEvaluation.dimensions, ...seekerEvaluation.dimensions]

  if (allDimensions.length === 0) {
    return {
      confidence: "POTENTIAL",
      confidenceInputs: {
        averageScore: 0,
        dimensionCount: 0,
        weakestDimension: "none",
        weakestScore: 0,
      },
    }
  }

  const dimensionCount = allDimensions.length
  const totalScore = allDimensions.reduce((sum, d) => sum + d.score, 0)
  const averageScore = totalScore / dimensionCount

  const weakest = allDimensions.reduce(
    (min, d) => (d.score < min.score ? d : min),
    allDimensions[0]!,
  )

  const confidence: "STRONG" | "GOOD" | "POTENTIAL" =
    averageScore >= 75 ? "STRONG" : averageScore >= 55 ? "GOOD" : "POTENTIAL"

  return {
    confidence,
    confidenceInputs: {
      averageScore,
      dimensionCount,
      weakestDimension: weakest.name,
      weakestScore: weakest.score,
    },
  }
}
