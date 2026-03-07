/**
 * Task 1.3 — Seeker agent tests (TDD RED phase)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Vercel AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}))

import { generateObject } from "ai"
import {
  buildSeekerPrompt,
  evaluateOpportunity,
  type OpportunityInput,
  type SeekerProfileInput,
  type SeekerPrivateSettings,
} from "./seeker-agent"

const mockGenerateObject = vi.mocked(generateObject)

const sampleOpportunity: OpportunityInput = {
  title: "Senior TypeScript Engineer",
  description: "Build scalable web applications",
  requiredSkills: ["TypeScript", "React", "Node.js"],
  experienceLevel: "SENIOR",
  employmentType: "FULL_TIME",
  locationType: "REMOTE",
  salaryMin: 100000,
  salaryMax: 150000,
  benefits: ["Health insurance", "401k"],
}

const sampleProfile: SeekerProfileInput = {
  name: "Jane Doe",
  headline: "Full-stack developer",
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
  experience: [{ title: "Senior Dev", years: 5 }],
  education: [{ degree: "BS Computer Science" }],
  location: "San Francisco, CA",
}

const samplePrivateSettings: SeekerPrivateSettings = {
  minSalary: 120000,
  dealBreakers: ["no remote work"],
  priorities: ["work-life balance", "career growth"],
  exclusions: ["fintech"],
}

describe("buildSeekerPrompt", () => {
  it("includes opportunity details in the prompt", () => {
    const { prompt } = buildSeekerPrompt(sampleOpportunity, sampleProfile, samplePrivateSettings)
    expect(prompt).toContain("Senior TypeScript Engineer")
    expect(prompt).toContain("TypeScript")
  })

  it("includes seeker profile in the prompt", () => {
    const { prompt } = buildSeekerPrompt(sampleOpportunity, sampleProfile, samplePrivateSettings)
    expect(prompt).toContain("Jane Doe")
    expect(prompt).toContain("Full-stack developer")
  })

  it("includes private settings in system prompt context (server-side only)", () => {
    const { system } = buildSeekerPrompt(sampleOpportunity, sampleProfile, samplePrivateSettings)
    // Private settings should be in the system prompt for the agent to use
    expect(system).toContain("120000")
    expect(system).toContain("no remote work")
    expect(system).toContain("work-life balance")
  })

  it("does NOT include raw private values in the user-visible prompt section", () => {
    const { prompt } = buildSeekerPrompt(sampleOpportunity, sampleProfile, samplePrivateSettings)
    // The user prompt should not contain private salary or deal-breakers
    expect(prompt).not.toContain("120000")
    expect(prompt).not.toContain("no remote work")
    expect(prompt).not.toContain("fintech")
  })

  it("includes anti-discrimination guardrails in system prompt", () => {
    const { system } = buildSeekerPrompt(sampleOpportunity, sampleProfile, samplePrivateSettings)
    expect(system).toContain("protected characteristics")
    expect(system).toMatch(/race|gender|age|disability/i)
  })

  it("instructs agent not to disclose exact private values", () => {
    const { system } = buildSeekerPrompt(sampleOpportunity, sampleProfile, samplePrivateSettings)
    expect(system).toMatch(/must not disclose|never reveal|do not share/i)
  })
})

describe("evaluateOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns validated AgentTurnOutput on success", async () => {
    const mockOutput = {
      content: "This role aligns well with my experience in TypeScript and React.",
      phase: "discovery" as const,
      decision: "CONTINUE" as const,
    }
    mockGenerateObject.mockResolvedValue({
      object: mockOutput,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      toJsonResponse: vi.fn(),
    } as never)

    const result = await evaluateOpportunity(
      sampleOpportunity,
      sampleProfile,
      samplePrivateSettings,
      "sk-test-key",
      "openai",
      [],
      "discovery",
    )

    expect(result).not.toBeNull()
    expect(result!.content).toContain("TypeScript")
    expect(result!.decision).toBe("CONTINUE")
  })

  it("returns null on LLM failure", async () => {
    mockGenerateObject.mockRejectedValue(new Error("API error"))

    const result = await evaluateOpportunity(
      sampleOpportunity,
      sampleProfile,
      samplePrivateSettings,
      "sk-test-key",
      "openai",
      [],
      "discovery",
    )

    expect(result).toBeNull()
  })

  it("returns null when LLM output fails schema validation", async () => {
    mockGenerateObject.mockResolvedValue({
      object: { content: "too short", phase: "invalid_phase", decision: "MAYBE" },
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      toJsonResponse: vi.fn(),
    } as never)

    const result = await evaluateOpportunity(
      sampleOpportunity,
      sampleProfile,
      samplePrivateSettings,
      "sk-test-key",
      "openai",
      [],
      "discovery",
    )

    expect(result).toBeNull()
  })

  it("passes conversation history to the prompt", async () => {
    const history = [
      {
        role: "employer_agent" as const,
        content: "We are looking for a senior engineer.",
        phase: "discovery" as const,
        timestamp: "2026-03-06T12:00:00Z",
        turnNumber: 0,
      },
    ]

    mockGenerateObject.mockResolvedValue({
      object: {
        content: "I have extensive experience in this area and am interested.",
        phase: "discovery" as const,
        decision: "CONTINUE" as const,
      },
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      toJsonResponse: vi.fn(),
    } as never)

    await evaluateOpportunity(
      sampleOpportunity,
      sampleProfile,
      samplePrivateSettings,
      "sk-test-key",
      "openai",
      history,
      "discovery",
    )

    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    const callArgs = mockGenerateObject.mock.calls[0]![0] as { prompt: string }
    expect(callArgs.prompt).toContain("We are looking for a senior engineer")
  })
})
