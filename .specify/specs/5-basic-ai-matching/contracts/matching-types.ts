/**
 * Type contracts for Feature 5: Basic AI Matching
 *
 * These types define the interface between components. Implementation
 * must conform to these contracts.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Agent Evaluation Schema (LLM output validation)
// ---------------------------------------------------------------------------

export const agentEvaluationSchema = z.object({
  score: z.number().int().min(0).max(100),
  confidence: z.enum(["STRONG", "GOOD", "POTENTIAL"]),
  matchSummary: z
    .string()
    .min(20)
    .max(1000)
    .describe("2-4 sentence explanation of match rationale"),
  strengthAreas: z
    .array(z.string().max(200))
    .min(1)
    .max(10)
    .describe("Areas where candidate excels for this role"),
  gapAreas: z
    .array(z.string().max(200))
    .max(10)
    .describe("Areas where candidate falls short"),
})

export type AgentEvaluation = z.infer<typeof agentEvaluationSchema>

// ---------------------------------------------------------------------------
// Confidence mapping
// ---------------------------------------------------------------------------

export function scoreToConfidence(
  score: number,
): "STRONG" | "GOOD" | "POTENTIAL" | null {
  if (score >= 70) return "STRONG"
  if (score >= 50) return "GOOD"
  if (score >= 30) return "POTENTIAL"
  return null // Below threshold — no match created
}

// ---------------------------------------------------------------------------
// Workflow Events (Inngest)
// ---------------------------------------------------------------------------

export const matchingEvents = {
  /** Fired when a job posting transitions to ACTIVE */
  "matching/posting.activated": z.object({
    jobPostingId: z.string(),
    employerId: z.string(),
  }),

  /** Fired when a single candidate evaluation completes */
  "matching/candidate.evaluated": z.object({
    jobPostingId: z.string(),
    seekerId: z.string(),
    score: z.number(),
    matched: z.boolean(),
  }),

  /** Fired when the full matching workflow completes */
  "matching/workflow.completed": z.object({
    jobPostingId: z.string(),
    totalCandidates: z.number(),
    matchesCreated: z.number(),
    skippedCount: z.number(),
  }),
} as const

// ---------------------------------------------------------------------------
// tRPC Procedure Contracts
// ---------------------------------------------------------------------------

/** matches.listForPosting — employer views matches for a posting */
export const listMatchesForPostingInput = z.object({
  jobPostingId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

/** matches.listForSeeker — job seeker views their matches */
export const listMatchesForSeekerInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

/** matches.updateStatus — accept or decline a match */
export const updateMatchStatusInput = z.object({
  matchId: z.string().min(1),
  status: z.enum(["ACCEPTED", "DECLINED"]),
})

/** matches.getWorkflowStatus — employer checks matching progress */
export const getWorkflowStatusInput = z.object({
  jobPostingId: z.string().min(1),
})

export const workflowStatusOutput = z.object({
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "NOT_STARTED"]),
  totalCandidates: z.number(),
  evaluatedCount: z.number(),
  matchesCreated: z.number(),
  error: z.string().nullable(),
})
