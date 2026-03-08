/**
 * Message redaction utilities for conversation logs.
 *
 * Two-layer approach:
 * 1. Field stripping — removes `evaluation` and `decision` fields
 * 2. Content regex — replaces dollar amounts and percentages with [REDACTED]
 *
 * @see .specify/specs/12-agent-conversation-logs/plan.md — TD-2
 */
import { z } from "zod"
import type { ConversationMessage } from "./conversation-schemas"

// ---------------------------------------------------------------------------
// Response schema (what clients receive)
// ---------------------------------------------------------------------------

export const redactedMessageSchema = z.object({
  role: z.enum(["employer_agent", "seeker_agent"]),
  content: z.string(),
  phase: z.string(),
  timestamp: z.string(),
  turnNumber: z.number(),
})

export type RedactedMessage = z.infer<typeof redactedMessageSchema>

// ---------------------------------------------------------------------------
// Redaction patterns
// ---------------------------------------------------------------------------

/** Matches dollar amounts: $100, $100k, $100K, $100,000, $100,000.00, $75.50 */
const DOLLAR_PATTERN = /\$[\d,]+(?:\.\d{1,2})?[kK]?/g

/** Matches percentages: 85%, 90.5% */
const PERCENT_PATTERN = /\d+(?:\.\d+)?%/g

const PLACEHOLDER = "[REDACTED]"

function redactContent(content: string): string {
  return content.replace(DOLLAR_PATTERN, PLACEHOLDER).replace(PERCENT_PATTERN, PLACEHOLDER)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function redactMessage(message: ConversationMessage): RedactedMessage {
  return {
    role: message.role,
    content: redactContent(message.content),
    phase: message.phase,
    timestamp: message.timestamp,
    turnNumber: message.turnNumber,
  }
}

export function redactConversationMessages(messages: ConversationMessage[]): RedactedMessage[] {
  return messages.map(redactMessage)
}
