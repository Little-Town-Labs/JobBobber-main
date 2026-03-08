/**
 * Zod schemas and types for agent-to-agent conversations.
 *
 * Defines the structure for conversation messages, agent turn output,
 * conversation context, and results. All agent output is validated
 * against these schemas before storage.
 *
 * @see .specify/specs/9-agent-to-agent-conversations/contracts/conversation-schemas.ts
 */
import { z } from "zod"

// ---------------------------------------------------------------------------
// Conversation Phases & Decisions
// ---------------------------------------------------------------------------

export const conversationPhaseSchema = z.enum([
  "discovery",
  "screening",
  "deep_evaluation",
  "negotiation",
  "decision",
])

export type ConversationPhase = z.infer<typeof conversationPhaseSchema>

export const conversationDecisionSchema = z.enum(["MATCH", "NO_MATCH", "CONTINUE"])

export type ConversationDecision = z.infer<typeof conversationDecisionSchema>

// ---------------------------------------------------------------------------
// Evaluation Dimensions & Agent Evaluation (Feature 10: Two-Way Matching)
// ---------------------------------------------------------------------------

export const dimensionNameSchema = z.enum([
  "skills_alignment",
  "experience_fit",
  "compensation_alignment",
  "work_arrangement",
  "culture_fit",
  "growth_potential",
])

export type DimensionName = z.infer<typeof dimensionNameSchema>

export const agentDimensionScoreSchema = z.object({
  name: dimensionNameSchema,
  score: z.number().int().min(0).max(100),
  reasoning: z.string().min(10).max(200),
})

export type AgentDimensionScore = z.infer<typeof agentDimensionScoreSchema>

export const agentEvaluationSchema = z.object({
  agentRole: z.enum(["employer_agent", "seeker_agent"]),
  overallScore: z.number().int().min(0).max(100),
  recommendation: z.enum(["MATCH", "NO_MATCH"]),
  reasoning: z.string().min(20).max(500),
  dimensions: z.array(agentDimensionScoreSchema).min(4).max(6),
})

export type AgentEvaluation = z.infer<typeof agentEvaluationSchema>

// ---------------------------------------------------------------------------
// Conversation Message (stored in AgentConversation.messages[])
// ---------------------------------------------------------------------------

export const conversationMessageSchema = z.object({
  role: z.enum(["employer_agent", "seeker_agent"]),
  content: z.string().max(2000),
  phase: conversationPhaseSchema,
  timestamp: z.string().datetime(),
  turnNumber: z.number().int().min(0),
  decision: conversationDecisionSchema.optional(),
  evaluation: agentEvaluationSchema.optional(),
})

export type ConversationMessage = z.infer<typeof conversationMessageSchema>

// ---------------------------------------------------------------------------
// Agent Turn Output (validated before storing as message)
// ---------------------------------------------------------------------------

export const agentTurnOutputSchema = z
  .object({
    content: z.string().min(10).max(2000),
    phase: conversationPhaseSchema,
    decision: conversationDecisionSchema,
    evaluation: agentEvaluationSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.decision === "CONTINUE") return true
      return data.evaluation !== undefined
    },
    {
      message: "evaluation is required when decision is MATCH or NO_MATCH",
      path: ["evaluation"],
    },
  )

export type AgentTurnOutput = z.infer<typeof agentTurnOutputSchema>

// ---------------------------------------------------------------------------
// Conversation Context (passed to orchestrator)
// ---------------------------------------------------------------------------

export const conversationContextSchema = z.object({
  conversationId: z.string(),
  jobPostingId: z.string(),
  seekerId: z.string(),
  employerId: z.string(),
  maxTurns: z.number().int().min(3).max(20).default(10),
  minTurnsBeforeDecision: z.number().int().min(1).max(10).default(3),
})

export type ConversationContext = z.infer<typeof conversationContextSchema>

// ---------------------------------------------------------------------------
// Conversation Result (returned by orchestrator)
// ---------------------------------------------------------------------------

export const conversationResultSchema = z.object({
  status: z.enum(["COMPLETED_MATCH", "COMPLETED_NO_MATCH", "TERMINATED"]),
  totalTurns: z.number().int(),
  matchSummary: z.string().optional(),
  confidence: z.enum(["STRONG", "GOOD", "POTENTIAL"]).optional(),
  terminationReason: z.string().optional(),
})

export type ConversationResult = z.infer<typeof conversationResultSchema>
