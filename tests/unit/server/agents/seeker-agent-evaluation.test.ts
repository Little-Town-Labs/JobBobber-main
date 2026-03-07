/**
 * T2.1 — Seeker Agent Evaluation Tests (RED → GREEN)
 *
 * Tests that the seeker agent produces structured evaluations on decision turns,
 * respects deal-breakers, and returns CONTINUE without evaluation on non-decision turns.
 * LLM calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

import { agentTurnOutputSchema } from "@/lib/conversation-schemas"
import type { ConversationMessage } from "@/lib/conversation-schemas"
import type {
  OpportunityInput,
  SeekerProfileInput,
  SeekerPrivateSettings,
} from "@/server/agents/seeker-agent"

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}))

vi.mock("@/server/agents/employer-agent", () => ({
  createProvider: vi.fn(() => vi.fn(() => "mock-model")),
}))

import { generateObject } from "ai"
import { evaluateOpportunity } from "@/server/agents/seeker-agent"

const mockedGenerateObject = vi.mocked(generateObject)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const opportunity: OpportunityInput = {
  title: "Senior Engineer",
  description: "Build amazing things",
  requiredSkills: ["TypeScript", "React"],
  experienceLevel: "Senior",
  employmentType: "Full-time",
  locationType: "remote",
  salaryMin: 100000,
  salaryMax: 150000,
  benefits: ["Health insurance"],
}

const profile: SeekerProfileInput = {
  name: "Jane Doe",
  headline: "Senior Engineer",
  skills: ["TypeScript", "React", "Node.js"],
  experience: [{ role: "Engineer", years: 5 }],
  education: [{ degree: "BS CS" }],
  location: "San Francisco, CA",
}

const privateSettings: SeekerPrivateSettings = {
  minSalary: 120000,
  dealBreakers: ["no onsite", "no relocation"],
  priorities: ["remote work", "growth", "compensation"],
  exclusions: ["Meta"],
}

const emptyHistory: ConversationMessage[] = []

function makeEvaluation(recommendation: "MATCH" | "NO_MATCH", overallScore: number) {
  return {
    agentRole: "seeker_agent",
    overallScore,
    recommendation,
    reasoning: "Evaluation reasoning with enough detail for validation",
    dimensions: [
      { name: "skills_alignment", score: overallScore, reasoning: "Skills assessment detail here" },
      { name: "experience_fit", score: overallScore, reasoning: "Experience assessment detail" },
      {
        name: "compensation_alignment",
        score: overallScore,
        reasoning: "Comp assessment detail here",
      },
      { name: "work_arrangement", score: overallScore, reasoning: "Work arrangement detail here" },
    ],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("seeker agent — structured evaluation on decision turns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns evaluation with dimension scores on MATCH decision", async () => {
    const mockOutput = {
      content: "This opportunity aligns well with my candidate's goals.",
      phase: "decision" as const,
      decision: "MATCH" as const,
      evaluation: makeEvaluation("MATCH", 80),
    }
    mockedGenerateObject.mockResolvedValue({ object: mockOutput } as never)

    const result = await evaluateOpportunity(
      opportunity,
      profile,
      privateSettings,
      "test-key",
      "openai",
      emptyHistory,
      "decision",
    )

    expect(result).not.toBeNull()
    const parsed = agentTurnOutputSchema.safeParse(result)
    expect(parsed.success).toBe(true)
    if (parsed.success && "evaluation" in parsed.data) {
      expect(parsed.data.evaluation).toBeDefined()
      expect(parsed.data.evaluation!.dimensions.length).toBeGreaterThanOrEqual(4)
    }
  })

  it("returns evaluation with dimension scores on NO_MATCH decision", async () => {
    const mockOutput = {
      content: "This opportunity does not align with my candidate's requirements.",
      phase: "decision" as const,
      decision: "NO_MATCH" as const,
      evaluation: makeEvaluation("NO_MATCH", 30),
    }
    mockedGenerateObject.mockResolvedValue({ object: mockOutput } as never)

    const result = await evaluateOpportunity(
      opportunity,
      profile,
      privateSettings,
      "test-key",
      "openai",
      emptyHistory,
      "decision",
    )

    expect(result).not.toBeNull()
    const parsed = agentTurnOutputSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it("returns CONTINUE without evaluation on non-decision turns", async () => {
    const mockOutput = {
      content: "I have some questions about the role requirements.",
      phase: "screening" as const,
      decision: "CONTINUE" as const,
    }
    mockedGenerateObject.mockResolvedValue({ object: mockOutput } as never)

    const result = await evaluateOpportunity(
      opportunity,
      profile,
      privateSettings,
      "test-key",
      "openai",
      emptyHistory,
      "screening",
    )

    expect(result).not.toBeNull()
    const parsed = agentTurnOutputSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it("rejects MATCH decision without evaluation (schema validation)", () => {
    const invalid = {
      content: "I recommend this match.",
      phase: "decision" as const,
      decision: "MATCH" as const,
      // no evaluation
    }
    const parsed = agentTurnOutputSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
  })
})

describe("seeker agent — deal-breaker detection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("signals NO_MATCH when deal-breaker triggered (onsite vs remote-only)", async () => {
    const onsiteOpportunity = { ...opportunity, locationType: "onsite" }
    const mockOutput = {
      content: "The work arrangement does not meet my candidate's requirements.",
      phase: "decision" as const,
      decision: "NO_MATCH" as const,
      evaluation: makeEvaluation("NO_MATCH", 25),
    }
    mockedGenerateObject.mockResolvedValue({ object: mockOutput } as never)

    const result = await evaluateOpportunity(
      onsiteOpportunity,
      profile,
      privateSettings,
      "test-key",
      "openai",
      emptyHistory,
      "decision",
    )

    expect(result).not.toBeNull()
    expect(result!.decision).toBe("NO_MATCH")
  })

  it("signals NO_MATCH when salary below minimum", async () => {
    const lowSalaryOpp = { ...opportunity, salaryMin: 50000, salaryMax: 80000 }
    const mockOutput = {
      content: "Compensation does not meet expectations.",
      phase: "decision" as const,
      decision: "NO_MATCH" as const,
      evaluation: makeEvaluation("NO_MATCH", 20),
    }
    mockedGenerateObject.mockResolvedValue({ object: mockOutput } as never)

    const result = await evaluateOpportunity(
      lowSalaryOpp,
      profile,
      privateSettings,
      "test-key",
      "openai",
      emptyHistory,
      "decision",
    )

    expect(result).not.toBeNull()
    expect(result!.decision).toBe("NO_MATCH")
  })
})
