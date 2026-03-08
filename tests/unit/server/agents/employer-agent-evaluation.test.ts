/**
 * T2.2 — Employer Agent Evaluation Tests (RED → GREEN)
 *
 * Tests that the employer agent produces structured evaluations on decision turns
 * and returns CONTINUE without evaluation on non-decision turns.
 * LLM calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

import { agentTurnOutputSchema } from "@/lib/conversation-schemas"

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => "mock-model")),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => "mock-model")),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvaluation(recommendation: "MATCH" | "NO_MATCH", overallScore: number) {
  return {
    agentRole: "employer_agent",
    overallScore,
    recommendation,
    reasoning: "Evaluation reasoning with sufficient detail for validation check",
    dimensions: [
      { name: "skills_alignment", score: overallScore, reasoning: "Skills assessment detail here" },
      { name: "experience_fit", score: overallScore, reasoning: "Experience level assessment" },
      { name: "culture_fit", score: overallScore, reasoning: "Culture alignment assessment" },
      { name: "growth_potential", score: overallScore, reasoning: "Growth potential assessment" },
    ],
  }
}

// ---------------------------------------------------------------------------
// Tests — we test the schema validation since the agent wrapper is inline
// ---------------------------------------------------------------------------

describe("employer agent — structured evaluation on decision turns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("accepts MATCH with valid evaluation containing employer dimensions", () => {
    const output = {
      content: "After thorough evaluation, this candidate is an excellent fit.",
      phase: "decision" as const,
      decision: "MATCH" as const,
      evaluation: makeEvaluation("MATCH", 85),
    }
    const parsed = agentTurnOutputSchema.safeParse(output)
    expect(parsed.success).toBe(true)
    if (parsed.success && "evaluation" in parsed.data) {
      expect(parsed.data.evaluation!.agentRole).toBe("employer_agent")
      expect(parsed.data.evaluation!.dimensions).toHaveLength(4)
    }
  })

  it("accepts NO_MATCH with valid evaluation", () => {
    const output = {
      content: "The candidate does not meet our requirements.",
      phase: "decision" as const,
      decision: "NO_MATCH" as const,
      evaluation: makeEvaluation("NO_MATCH", 25),
    }
    const parsed = agentTurnOutputSchema.safeParse(output)
    expect(parsed.success).toBe(true)
  })

  it("accepts CONTINUE without evaluation", () => {
    const output = {
      content: "I would like to explore the candidate's experience further.",
      phase: "screening" as const,
      decision: "CONTINUE" as const,
    }
    const parsed = agentTurnOutputSchema.safeParse(output)
    expect(parsed.success).toBe(true)
  })

  it("rejects MATCH without evaluation", () => {
    const output = {
      content: "This candidate is a great fit.",
      phase: "decision" as const,
      decision: "MATCH" as const,
    }
    const parsed = agentTurnOutputSchema.safeParse(output)
    expect(parsed.success).toBe(false)
  })

  it("evaluation includes all expected dimension types", () => {
    const eval6 = {
      agentRole: "employer_agent",
      overallScore: 75,
      recommendation: "MATCH",
      reasoning: "Comprehensive evaluation with strong alignment across dimensions",
      dimensions: [
        { name: "skills_alignment", score: 85, reasoning: "Strong TypeScript and React skills" },
        { name: "experience_fit", score: 80, reasoning: "Five years relevant experience" },
        { name: "compensation_alignment", score: 70, reasoning: "Within budget range for role" },
        { name: "work_arrangement", score: 90, reasoning: "Remote-friendly as required" },
        { name: "culture_fit", score: 75, reasoning: "Values align with team culture" },
        { name: "growth_potential", score: 65, reasoning: "Room for growth in leadership" },
      ],
    }
    const output = {
      content: "Full evaluation complete.",
      phase: "decision" as const,
      decision: "MATCH" as const,
      evaluation: eval6,
    }
    const parsed = agentTurnOutputSchema.safeParse(output)
    expect(parsed.success).toBe(true)
    if (parsed.success && "evaluation" in parsed.data) {
      expect(parsed.data.evaluation!.dimensions).toHaveLength(6)
    }
  })
})
