/**
 * Task 1.1 — Conversation schema tests (TDD RED phase)
 */
import { describe, it, expect } from "vitest"
import {
  conversationMessageSchema,
  agentTurnOutputSchema,
  conversationContextSchema,
  conversationResultSchema,
  type ConversationMessage,
} from "./conversation-schemas"

describe("conversationMessageSchema", () => {
  const validMessage: ConversationMessage = {
    role: "employer_agent",
    content: "Let me introduce this role to you.",
    phase: "discovery",
    timestamp: "2026-03-06T12:00:00Z",
    turnNumber: 0,
  }

  it("accepts a valid message without decision", () => {
    expect(conversationMessageSchema.parse(validMessage)).toEqual(validMessage)
  })

  it("accepts a valid message with decision", () => {
    const msg = { ...validMessage, decision: "MATCH" as const }
    expect(conversationMessageSchema.parse(msg)).toEqual(msg)
  })

  it("accepts seeker_agent role", () => {
    const msg = { ...validMessage, role: "seeker_agent" as const }
    expect(conversationMessageSchema.parse(msg)).toEqual(msg)
  })

  it("accepts all valid phases", () => {
    const phases = ["discovery", "screening", "deep_evaluation", "negotiation", "decision"] as const
    for (const phase of phases) {
      expect(() => conversationMessageSchema.parse({ ...validMessage, phase })).not.toThrow()
    }
  })

  it("rejects invalid role", () => {
    expect(() => conversationMessageSchema.parse({ ...validMessage, role: "system" })).toThrow()
  })

  it("rejects invalid phase", () => {
    expect(() => conversationMessageSchema.parse({ ...validMessage, phase: "unknown" })).toThrow()
  })

  it("rejects content exceeding 2000 chars", () => {
    expect(() =>
      conversationMessageSchema.parse({ ...validMessage, content: "x".repeat(2001) }),
    ).toThrow()
  })

  it("rejects negative turnNumber", () => {
    expect(() => conversationMessageSchema.parse({ ...validMessage, turnNumber: -1 })).toThrow()
  })

  it("rejects non-integer turnNumber", () => {
    expect(() => conversationMessageSchema.parse({ ...validMessage, turnNumber: 1.5 })).toThrow()
  })

  it("rejects missing required fields", () => {
    expect(() => conversationMessageSchema.parse({})).toThrow()
    expect(() => conversationMessageSchema.parse({ role: "employer_agent" })).toThrow()
  })

  it("rejects invalid decision", () => {
    expect(() => conversationMessageSchema.parse({ ...validMessage, decision: "MAYBE" })).toThrow()
  })
})

describe("agentTurnOutputSchema", () => {
  const validOutput = {
    content: "This candidate looks promising for the role.",
    phase: "screening" as const,
    decision: "CONTINUE" as const,
  }

  it("accepts valid turn output", () => {
    expect(agentTurnOutputSchema.parse(validOutput)).toEqual(validOutput)
  })

  it("accepts all decision types", () => {
    for (const decision of ["MATCH", "NO_MATCH", "CONTINUE"] as const) {
      expect(() => agentTurnOutputSchema.parse({ ...validOutput, decision })).not.toThrow()
    }
  })

  it("rejects content shorter than 10 chars", () => {
    expect(() => agentTurnOutputSchema.parse({ ...validOutput, content: "short" })).toThrow()
  })

  it("rejects content longer than 2000 chars", () => {
    expect(() =>
      agentTurnOutputSchema.parse({ ...validOutput, content: "x".repeat(2001) }),
    ).toThrow()
  })
})

describe("conversationContextSchema", () => {
  const validCtx = {
    conversationId: "conv_123",
    jobPostingId: "jp_123",
    seekerId: "seeker_123",
    employerId: "emp_123",
  }

  it("accepts valid context with defaults", () => {
    const result = conversationContextSchema.parse(validCtx)
    expect(result.maxTurns).toBe(10)
    expect(result.minTurnsBeforeDecision).toBe(3)
  })

  it("accepts custom maxTurns and minTurns", () => {
    const result = conversationContextSchema.parse({
      ...validCtx,
      maxTurns: 15,
      minTurnsBeforeDecision: 5,
    })
    expect(result.maxTurns).toBe(15)
    expect(result.minTurnsBeforeDecision).toBe(5)
  })

  it("rejects maxTurns below 3", () => {
    expect(() => conversationContextSchema.parse({ ...validCtx, maxTurns: 2 })).toThrow()
  })

  it("rejects maxTurns above 20", () => {
    expect(() => conversationContextSchema.parse({ ...validCtx, maxTurns: 21 })).toThrow()
  })
})

describe("conversationResultSchema", () => {
  it("accepts COMPLETED_MATCH with summary and confidence", () => {
    expect(() =>
      conversationResultSchema.parse({
        status: "COMPLETED_MATCH",
        totalTurns: 6,
        matchSummary: "Strong alignment on skills and compensation.",
        confidence: "STRONG",
      }),
    ).not.toThrow()
  })

  it("accepts COMPLETED_NO_MATCH without summary", () => {
    expect(() =>
      conversationResultSchema.parse({
        status: "COMPLETED_NO_MATCH",
        totalTurns: 4,
        terminationReason: "Salary misalignment",
      }),
    ).not.toThrow()
  })

  it("accepts TERMINATED with reason", () => {
    expect(() =>
      conversationResultSchema.parse({
        status: "TERMINATED",
        totalTurns: 2,
        terminationReason: "Guardrail violation",
      }),
    ).not.toThrow()
  })

  it("rejects invalid status", () => {
    expect(() => conversationResultSchema.parse({ status: "RUNNING", totalTurns: 1 })).toThrow()
  })
})
