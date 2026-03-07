/**
 * Task 2.1 — Conversation orchestrator tests (TDD RED phase)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("ai", () => ({ generateObject: vi.fn() }))

import {
  runConversationTurn,
  shouldTerminate,
  derivePhase,
  type OrchestratorInput,
} from "./conversation-orchestrator"
import type { AgentTurnOutput } from "@/lib/conversation-schemas"
import type { PostingInput, CandidateInput } from "./employer-agent"
import type { SeekerPrivateSettings, OpportunityInput } from "./seeker-agent"
import type { PrivateValues } from "./privacy-filter"

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const basePosting: PostingInput = {
  title: "Engineer",
  description: "Build things",
  requiredSkills: ["TypeScript"],
  preferredSkills: [],
  experienceLevel: "MID",
  employmentType: "FULL_TIME",
  locationType: "REMOTE",
  locationReq: null,
  salaryMin: 80000,
  salaryMax: 130000,
  benefits: [],
  whyApply: null,
}

const baseCandidate: CandidateInput = {
  name: "Test User",
  headline: "Developer",
  skills: ["TypeScript", "React"],
  experience: [],
  education: [],
  location: "Remote",
  profileCompleteness: 80,
}

const baseOpportunity: OpportunityInput = {
  title: "Engineer",
  description: "Build things",
  requiredSkills: ["TypeScript"],
  experienceLevel: "MID",
  employmentType: "FULL_TIME",
  locationType: "REMOTE",
  salaryMin: 80000,
  salaryMax: 130000,
  benefits: [],
}

const seekerPrivate: SeekerPrivateSettings = {
  minSalary: 90000,
  dealBreakers: [],
  priorities: ["remote work"],
  exclusions: [],
}

const privateValues: PrivateValues = {
  seekerMinSalary: 90000,
  seekerDealBreakers: [],
  employerTrueMaxSalary: 140000,
}

const makeTurnOutput = (
  decision: "MATCH" | "NO_MATCH" | "CONTINUE",
  phase = "discovery",
): AgentTurnOutput => ({
  content: "This is a substantive response about the role and candidate fit.",
  phase: phase as AgentTurnOutput["phase"],
  decision,
})

// ---------------------------------------------------------------------------
// derivePhase
// ---------------------------------------------------------------------------

describe("derivePhase", () => {
  it("returns discovery for turns 0-1", () => {
    expect(derivePhase(0, 10)).toBe("discovery")
    expect(derivePhase(1, 10)).toBe("discovery")
  })

  it("returns screening for turns 2-3", () => {
    expect(derivePhase(2, 10)).toBe("screening")
    expect(derivePhase(3, 10)).toBe("screening")
  })

  it("returns deep_evaluation for middle turns", () => {
    expect(derivePhase(4, 10)).toBe("deep_evaluation")
    expect(derivePhase(5, 10)).toBe("deep_evaluation")
  })

  it("returns negotiation for later turns", () => {
    expect(derivePhase(6, 10)).toBe("negotiation")
    expect(derivePhase(7, 10)).toBe("negotiation")
  })

  it("returns decision for final turns", () => {
    expect(derivePhase(8, 10)).toBe("decision")
    expect(derivePhase(9, 10)).toBe("decision")
  })
})

// ---------------------------------------------------------------------------
// shouldTerminate
// ---------------------------------------------------------------------------

describe("shouldTerminate", () => {
  it("returns null when both agents signal CONTINUE", () => {
    const result = shouldTerminate("CONTINUE", "CONTINUE", 4, 3, 10)
    expect(result).toBeNull()
  })

  it("returns COMPLETED_MATCH when both signal MATCH after min turns", () => {
    const result = shouldTerminate("MATCH", "MATCH", 4, 3, 10)
    expect(result).toBe("COMPLETED_MATCH")
  })

  it("returns COMPLETED_NO_MATCH when employer signals NO_MATCH after min turns", () => {
    const result = shouldTerminate("NO_MATCH", "CONTINUE", 4, 3, 10)
    expect(result).toBe("COMPLETED_NO_MATCH")
  })

  it("returns COMPLETED_NO_MATCH when seeker signals NO_MATCH after min turns", () => {
    const result = shouldTerminate("CONTINUE", "NO_MATCH", 4, 3, 10)
    expect(result).toBe("COMPLETED_NO_MATCH")
  })

  it("returns COMPLETED_NO_MATCH when one MATCH and one NO_MATCH", () => {
    const result = shouldTerminate("MATCH", "NO_MATCH", 4, 3, 10)
    expect(result).toBe("COMPLETED_NO_MATCH")
  })

  it("forces CONTINUE before min turns even if agents signal MATCH", () => {
    const result = shouldTerminate("MATCH", "MATCH", 2, 3, 10)
    expect(result).toBeNull()
  })

  it("returns COMPLETED_NO_MATCH at max turns without consensus", () => {
    const result = shouldTerminate("CONTINUE", "CONTINUE", 10, 3, 10)
    expect(result).toBe("COMPLETED_NO_MATCH")
  })

  it("returns COMPLETED_MATCH at max turns if both signal MATCH", () => {
    const result = shouldTerminate("MATCH", "MATCH", 10, 3, 10)
    expect(result).toBe("COMPLETED_MATCH")
  })

  it("allows NO_MATCH before min turns (early rejection)", () => {
    // NO_MATCH is allowed before min turns — it's an early exit
    const result = shouldTerminate("NO_MATCH", "CONTINUE", 2, 3, 10)
    expect(result).toBe("COMPLETED_NO_MATCH")
  })
})

// ---------------------------------------------------------------------------
// runConversationTurn
// ---------------------------------------------------------------------------

describe("runConversationTurn", () => {
  const mockEmployerAgent = vi.fn<() => Promise<AgentTurnOutput | null>>()
  const mockSeekerAgent = vi.fn<() => Promise<AgentTurnOutput | null>>()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseInput: OrchestratorInput = {
    posting: basePosting,
    candidate: baseCandidate,
    opportunity: baseOpportunity,
    seekerPrivateSettings: seekerPrivate,
    privateValues,
    employerApiKey: "sk-emp",
    employerProvider: "openai",
    seekerApiKey: "sk-seek",
    seekerProvider: "openai",
    maxTurns: 10,
    minTurnsBeforeDecision: 3,
  }

  it("calls employer agent on even turns", async () => {
    mockEmployerAgent.mockResolvedValue(makeTurnOutput("CONTINUE"))

    const result = await runConversationTurn({
      input: baseInput,
      turnNumber: 0,
      messages: [],
      employerAgent: mockEmployerAgent,
      seekerAgent: mockSeekerAgent,
    })

    expect(mockEmployerAgent).toHaveBeenCalledTimes(1)
    expect(mockSeekerAgent).not.toHaveBeenCalled()
    expect(result.message.role).toBe("employer_agent")
  })

  it("calls seeker agent on odd turns", async () => {
    mockSeekerAgent.mockResolvedValue(makeTurnOutput("CONTINUE"))

    const result = await runConversationTurn({
      input: baseInput,
      turnNumber: 1,
      messages: [],
      employerAgent: mockEmployerAgent,
      seekerAgent: mockSeekerAgent,
    })

    expect(mockSeekerAgent).toHaveBeenCalledTimes(1)
    expect(mockEmployerAgent).not.toHaveBeenCalled()
    expect(result.message.role).toBe("seeker_agent")
  })

  it("applies privacy filter to message content", async () => {
    mockEmployerAgent.mockResolvedValue({
      content: "We can offer up to 140000 for this position which is above market.",
      phase: "negotiation" as const,
      decision: "CONTINUE" as const,
    })

    const result = await runConversationTurn({
      input: baseInput,
      turnNumber: 0,
      messages: [],
      employerAgent: mockEmployerAgent,
      seekerAgent: mockSeekerAgent,
    })

    expect(result.message.content).not.toContain("140000")
    expect(result.message.content).toContain("[REDACTED]")
  })

  it("returns TERMINATED when agent returns null (failure)", async () => {
    mockEmployerAgent.mockResolvedValue(null)

    const result = await runConversationTurn({
      input: baseInput,
      turnNumber: 0,
      messages: [],
      employerAgent: mockEmployerAgent,
      seekerAgent: mockSeekerAgent,
    })

    expect(result.terminated).toBe(true)
    expect(result.terminationReason).toMatch(/failed/i)
  })

  it("includes turnNumber and timestamp in stored message", async () => {
    mockEmployerAgent.mockResolvedValue(makeTurnOutput("CONTINUE"))

    const result = await runConversationTurn({
      input: baseInput,
      turnNumber: 4,
      messages: [],
      employerAgent: mockEmployerAgent,
      seekerAgent: mockSeekerAgent,
    })

    expect(result.message.turnNumber).toBe(4)
    expect(result.message.timestamp).toBeDefined()
  })

  it("tracks phase progression based on turn number", async () => {
    mockEmployerAgent.mockResolvedValue(makeTurnOutput("CONTINUE", "screening"))

    const result = await runConversationTurn({
      input: baseInput,
      turnNumber: 2,
      messages: [],
      employerAgent: mockEmployerAgent,
      seekerAgent: mockSeekerAgent,
    })

    expect(result.message.phase).toBeDefined()
  })
})
