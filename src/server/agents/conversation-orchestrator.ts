/**
 * Conversation orchestrator — manages turn-taking between employer and seeker agents.
 *
 * Handles phase progression, termination evaluation, privacy filtering,
 * and match decision protocol.
 *
 * @see .specify/specs/9-agent-to-agent-conversations/plan.md — Phase 2
 */
import type {
  ConversationMessage,
  AgentTurnOutput,
  ConversationPhase,
  ConversationDecision,
} from "@/lib/conversation-schemas"
import type { PostingInput, CandidateInput } from "./employer-agent"
import type { SeekerPrivateSettings, OpportunityInput } from "./seeker-agent"
import { filterPrivateValues, type PrivateValues } from "./privacy-filter"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorInput {
  posting: PostingInput
  candidate: CandidateInput
  opportunity: OpportunityInput
  seekerPrivateSettings: SeekerPrivateSettings
  privateValues: PrivateValues
  employerApiKey: string
  employerProvider: string
  seekerApiKey: string
  seekerProvider: string
  maxTurns: number
  minTurnsBeforeDecision: number
}

export interface TurnResult {
  message: ConversationMessage
  terminated: boolean
  terminationReason?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentFn = (...args: any[]) => Promise<AgentTurnOutput | null>

export interface RunTurnParams {
  input: OrchestratorInput
  turnNumber: number
  messages: ConversationMessage[]
  employerAgent: AgentFn
  seekerAgent: AgentFn
}

// ---------------------------------------------------------------------------
// Phase derivation
// ---------------------------------------------------------------------------

/**
 * Derive the conversation phase based on turn number and max turns.
 * Phases progress proportionally through the conversation.
 */
export function derivePhase(turnNumber: number, maxTurns: number): ConversationPhase {
  const progress = turnNumber / maxTurns
  if (progress < 0.2) return "discovery"
  if (progress < 0.4) return "screening"
  if (progress < 0.6) return "deep_evaluation"
  if (progress < 0.8) return "negotiation"
  return "decision"
}

// ---------------------------------------------------------------------------
// Termination evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the conversation should terminate.
 * Returns the terminal status or null if conversation should continue.
 */
export function shouldTerminate(
  employerDecision: ConversationDecision,
  seekerDecision: ConversationDecision,
  turnNumber: number,
  minTurns: number,
  maxTurns: number,
): "COMPLETED_MATCH" | "COMPLETED_NO_MATCH" | null {
  // NO_MATCH is always respected (early exit)
  if (employerDecision === "NO_MATCH" || seekerDecision === "NO_MATCH") {
    return "COMPLETED_NO_MATCH"
  }

  // Max turns reached
  if (turnNumber >= maxTurns) {
    if (employerDecision === "MATCH" && seekerDecision === "MATCH") {
      return "COMPLETED_MATCH"
    }
    return "COMPLETED_NO_MATCH"
  }

  // Before min turns, only NO_MATCH can terminate (handled above)
  if (turnNumber < minTurns) {
    return null
  }

  // Both signal MATCH after min turns
  if (employerDecision === "MATCH" && seekerDecision === "MATCH") {
    return "COMPLETED_MATCH"
  }

  return null
}

// ---------------------------------------------------------------------------
// Single turn execution
// ---------------------------------------------------------------------------

/**
 * Execute a single conversation turn.
 * Alternates between employer (even) and seeker (odd) agents.
 * Applies privacy filter to all output before storing.
 */
export async function runConversationTurn(params: RunTurnParams): Promise<TurnResult> {
  const { input, turnNumber, messages, employerAgent, seekerAgent } = params
  const isEmployerTurn = turnNumber % 2 === 0
  const phase = derivePhase(turnNumber, input.maxTurns)

  const agentOutput: AgentTurnOutput | null = isEmployerTurn
    ? await employerAgent(
        input.posting,
        input.candidate,
        messages,
        phase,
        input.employerApiKey,
        input.employerProvider,
      )
    : await seekerAgent(
        input.opportunity,
        input.seekerPrivateSettings,
        messages,
        phase,
        input.seekerApiKey,
        input.seekerProvider,
      )

  if (!agentOutput) {
    return {
      message: {
        role: isEmployerTurn ? "employer_agent" : "seeker_agent",
        content: "[Agent failed to respond]",
        phase,
        timestamp: new Date().toISOString(),
        turnNumber,
      },
      terminated: true,
      terminationReason: "Agent failed to produce valid output",
    }
  }

  // Apply privacy filter to content before storage
  const filteredContent = filterPrivateValues(agentOutput.content, input.privateValues)

  const message: ConversationMessage = {
    role: isEmployerTurn ? "employer_agent" : "seeker_agent",
    content: filteredContent,
    phase,
    timestamp: new Date().toISOString(),
    turnNumber,
    decision: agentOutput.decision,
  }

  return { message, terminated: false }
}
