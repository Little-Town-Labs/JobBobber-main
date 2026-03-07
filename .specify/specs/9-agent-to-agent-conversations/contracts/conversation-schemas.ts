/**
 * Type contracts for agent-to-agent conversation system.
 * These define the Zod schemas that will be implemented in
 * src/lib/conversation-schemas.ts
 */
import { z } from "zod"

// ---------------------------------------------------------------------------
// Conversation Message (stored in AgentConversation.messages[])
// ---------------------------------------------------------------------------

export const conversationPhaseSchema = z.enum([
  "discovery",
  "screening",
  "deep_evaluation",
  "negotiation",
  "decision",
])

export const conversationDecisionSchema = z.enum(["MATCH", "NO_MATCH", "CONTINUE"])

export const conversationMessageSchema = z.object({
  role: z.enum(["employer_agent", "seeker_agent"]),
  content: z.string().max(2000),
  phase: conversationPhaseSchema,
  timestamp: z.string().datetime(),
  turnNumber: z.number().int().min(0),
  decision: conversationDecisionSchema.optional(),
})

export type ConversationMessage = z.infer<typeof conversationMessageSchema>

// ---------------------------------------------------------------------------
// Agent Turn Output (validated before storing as message)
// ---------------------------------------------------------------------------

export const agentTurnOutputSchema = z.object({
  content: z.string().min(10).max(2000),
  phase: conversationPhaseSchema,
  decision: conversationDecisionSchema,
})

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

// ---------------------------------------------------------------------------
// Inngest Event Payloads
// ---------------------------------------------------------------------------

export const conversationStartEventSchema = z.object({
  jobPostingId: z.string(),
  seekerId: z.string(),
  employerId: z.string(),
})

export type ConversationStartEvent = z.infer<typeof conversationStartEventSchema>

// ---------------------------------------------------------------------------
// Privacy Filter Config
// ---------------------------------------------------------------------------

export const privateValuesToFilterSchema = z.object({
  // Seeker private values
  seekerMinSalary: z.number().nullable(),
  seekerDealBreakers: z.array(z.string()),
  // Employer private values
  employerTrueMaxSalary: z.number().nullable(),
})

export type PrivateValuesToFilter = z.infer<typeof privateValuesToFilterSchema>
