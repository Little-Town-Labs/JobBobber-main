import { describe, it, expect } from "vitest"

import { redactMessage, redactConversationMessages } from "./redaction"
import type { ConversationMessage } from "./conversation-schemas"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessage(overrides?: Partial<ConversationMessage>): ConversationMessage {
  return {
    role: "employer_agent",
    content: "Let's discuss the role.",
    phase: "discovery",
    timestamp: "2026-03-07T12:00:00Z",
    turnNumber: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// redactMessage
// ---------------------------------------------------------------------------

describe("redactMessage", () => {
  it("preserves safe fields (role, phase, timestamp, turnNumber)", () => {
    const result = redactMessage(makeMessage())

    expect(result.role).toBe("employer_agent")
    expect(result.phase).toBe("discovery")
    expect(result.timestamp).toBe("2026-03-07T12:00:00Z")
    expect(result.turnNumber).toBe(1)
  })

  it("strips evaluation field", () => {
    const msg = makeMessage({
      evaluation: {
        agentRole: "employer_agent",
        overallScore: 85,
        recommendation: "MATCH",
        reasoning: "Strong technical skills alignment with role requirements",
        dimensions: [
          { name: "skills_alignment", score: 90, reasoning: "Excellent TypeScript skills match" },
          { name: "experience_fit", score: 80, reasoning: "Good experience level for role" },
          { name: "compensation_alignment", score: 85, reasoning: "Within budget range" },
          { name: "culture_fit", score: 82, reasoning: "Remote-first alignment is good" },
        ],
      },
    })

    const result = redactMessage(msg)

    expect(result).not.toHaveProperty("evaluation")
  })

  it("strips decision field", () => {
    const msg = makeMessage({ decision: "MATCH" })
    const result = redactMessage(msg)

    expect(result).not.toHaveProperty("decision")
  })

  // Dollar amount patterns
  it("redacts $X,XXX patterns", () => {
    const msg = makeMessage({ content: "The salary is $100,000 per year." })
    const result = redactMessage(msg)

    expect(result.content).toContain("[REDACTED]")
    expect(result.content).not.toContain("$100,000")
  })

  it("redacts $XXk patterns", () => {
    const msg = makeMessage({ content: "We can offer $120k for this position." })
    const result = redactMessage(msg)

    expect(result.content).toContain("[REDACTED]")
    expect(result.content).not.toContain("$120k")
  })

  it("redacts $XXK patterns (uppercase)", () => {
    const msg = makeMessage({ content: "Budget is $85K." })
    const result = redactMessage(msg)

    expect(result.content).toContain("[REDACTED]")
    expect(result.content).not.toContain("$85K")
  })

  it("redacts salary range patterns ($X-$Y)", () => {
    const msg = makeMessage({ content: "Range is $80,000 - $120,000." })
    const result = redactMessage(msg)

    expect(result.content).not.toContain("$80,000")
    expect(result.content).not.toContain("$120,000")
  })

  it("redacts $X.XX decimal amounts", () => {
    const msg = makeMessage({ content: "Hourly rate of $75.50 is standard." })
    const result = redactMessage(msg)

    expect(result.content).not.toContain("$75.50")
  })

  it("redacts plain dollar amounts without commas", () => {
    const msg = makeMessage({ content: "Minimum is $80000." })
    const result = redactMessage(msg)

    expect(result.content).not.toContain("$80000")
  })

  // Percentage patterns
  it("redacts percentage patterns", () => {
    const msg = makeMessage({ content: "Match confidence is 85% for this candidate." })
    const result = redactMessage(msg)

    expect(result.content).toContain("[REDACTED]")
    expect(result.content).not.toContain("85%")
  })

  it("redacts decimal percentage patterns", () => {
    const msg = makeMessage({ content: "Score is 90.5% overall." })
    const result = redactMessage(msg)

    expect(result.content).not.toContain("90.5%")
  })

  // Content preservation
  it("preserves non-sensitive content", () => {
    const msg = makeMessage({
      content: "The candidate has strong TypeScript skills and experience with React.",
    })
    const result = redactMessage(msg)

    expect(result.content).toBe(
      "The candidate has strong TypeScript skills and experience with React.",
    )
  })

  it("handles message with no sensitive content", () => {
    const msg = makeMessage({ content: "Hello, let's begin the discussion." })
    const result = redactMessage(msg)

    expect(result.content).toBe("Hello, let's begin the discussion.")
  })

  it("handles empty content", () => {
    const msg = makeMessage({ content: "" })
    const result = redactMessage(msg)

    expect(result.content).toBe("")
  })

  it("handles multiple sensitive values in one message", () => {
    const msg = makeMessage({
      content: "Salary range $80k-$120k with 15% bonus and $5,000 signing bonus.",
    })
    const result = redactMessage(msg)

    expect(result.content).not.toContain("$80k")
    expect(result.content).not.toContain("$120k")
    expect(result.content).not.toContain("15%")
    expect(result.content).not.toContain("$5,000")
  })

  it("returns only the allowed fields", () => {
    const msg = makeMessage({
      decision: "CONTINUE",
      evaluation: {
        agentRole: "seeker_agent",
        overallScore: 70,
        recommendation: "NO_MATCH",
        reasoning: "Compensation misalignment detected in negotiation",
        dimensions: [
          { name: "skills_alignment", score: 60, reasoning: "Partial skills overlap only" },
          { name: "experience_fit", score: 70, reasoning: "Adequate experience level" },
          { name: "compensation_alignment", score: 40, reasoning: "Below minimum threshold" },
          { name: "culture_fit", score: 75, reasoning: "Reasonable culture alignment" },
        ],
      },
    })
    const result = redactMessage(msg)
    const keys = Object.keys(result)

    expect(keys).toEqual(
      expect.arrayContaining(["role", "content", "phase", "timestamp", "turnNumber"]),
    )
    expect(keys).not.toContain("evaluation")
    expect(keys).not.toContain("decision")
  })
})

// ---------------------------------------------------------------------------
// redactConversationMessages
// ---------------------------------------------------------------------------

describe("redactConversationMessages", () => {
  it("redacts all messages in array", () => {
    const messages: ConversationMessage[] = [
      makeMessage({ content: "Offering $100k.", turnNumber: 1 }),
      makeMessage({
        role: "seeker_agent",
        content: "Looking for $120k minimum.",
        turnNumber: 2,
      }),
    ]

    const result = redactConversationMessages(messages)

    expect(result).toHaveLength(2)
    expect(result[0]!.content).not.toContain("$100k")
    expect(result[1]!.content).not.toContain("$120k")
  })

  it("returns empty array for empty input", () => {
    expect(redactConversationMessages([])).toEqual([])
  })
})
