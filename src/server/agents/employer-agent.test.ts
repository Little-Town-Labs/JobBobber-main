/**
 * Task 1.1 — Tests for employer agent evaluation logic.
 *
 * Mocks the Vercel AI SDK `generateObject` to test evaluation
 * without real LLM calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGenerateObject } = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
}))

vi.mock("ai", () => ({
  generateObject: mockGenerateObject,
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn()),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { evaluateCandidate, buildEvaluationPrompt, createProvider } from "./employer-agent"
import { scoreToConfidence, agentEvaluationSchema } from "@/lib/matching-schemas"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const POSTING = {
  title: "Software Engineer",
  description: "Build scalable web applications",
  requiredSkills: ["TypeScript", "React"],
  preferredSkills: ["Node.js"],
  experienceLevel: "MID" as const,
  employmentType: "FULL_TIME" as const,
  locationType: "REMOTE" as const,
  locationReq: null,
  salaryMin: 80000,
  salaryMax: 120000,
  benefits: ["Health Insurance"],
  whyApply: "Great team culture",
}

const CANDIDATE = {
  name: "Jane Doe",
  headline: "Full-Stack Developer",
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
  experience: [{ title: "Senior Dev", company: "Acme", years: 3 }],
  education: [{ degree: "BS Computer Science", school: "MIT" }],
  location: "San Francisco, CA",
  profileCompleteness: 0.85,
}

const VALID_EVALUATION = {
  score: 78,
  confidence: "STRONG" as const,
  matchSummary:
    "Jane is a strong match for this role with excellent TypeScript and React skills plus Node.js experience.",
  strengthAreas: ["TypeScript proficiency", "React expertise", "Relevant backend experience"],
  gapAreas: ["No specific mention of scalability experience"],
}

// ---------------------------------------------------------------------------
// Schema Tests
// ---------------------------------------------------------------------------

describe("agentEvaluationSchema", () => {
  it("accepts valid evaluation", () => {
    expect(() => agentEvaluationSchema.parse(VALID_EVALUATION)).not.toThrow()
  })

  it("rejects score below 0", () => {
    expect(() => agentEvaluationSchema.parse({ ...VALID_EVALUATION, score: -1 })).toThrow()
  })

  it("rejects score above 100", () => {
    expect(() => agentEvaluationSchema.parse({ ...VALID_EVALUATION, score: 101 })).toThrow()
  })

  it("rejects non-integer score", () => {
    expect(() => agentEvaluationSchema.parse({ ...VALID_EVALUATION, score: 78.5 })).toThrow()
  })

  it("rejects missing matchSummary", () => {
    const { matchSummary: _, ...without } = VALID_EVALUATION
    expect(() => agentEvaluationSchema.parse(without)).toThrow()
  })

  it("rejects empty strengthAreas", () => {
    expect(() => agentEvaluationSchema.parse({ ...VALID_EVALUATION, strengthAreas: [] })).toThrow()
  })

  it("rejects invalid confidence value", () => {
    expect(() =>
      agentEvaluationSchema.parse({ ...VALID_EVALUATION, confidence: "EXCELLENT" }),
    ).toThrow()
  })

  it("rejects matchSummary shorter than 20 chars", () => {
    expect(() =>
      agentEvaluationSchema.parse({ ...VALID_EVALUATION, matchSummary: "Too short" }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// scoreToConfidence Tests
// ---------------------------------------------------------------------------

describe("scoreToConfidence", () => {
  it("returns STRONG for score 70-100", () => {
    expect(scoreToConfidence(70)).toBe("STRONG")
    expect(scoreToConfidence(85)).toBe("STRONG")
    expect(scoreToConfidence(100)).toBe("STRONG")
  })

  it("returns GOOD for score 50-69", () => {
    expect(scoreToConfidence(50)).toBe("GOOD")
    expect(scoreToConfidence(60)).toBe("GOOD")
    expect(scoreToConfidence(69)).toBe("GOOD")
  })

  it("returns POTENTIAL for score 30-49", () => {
    expect(scoreToConfidence(30)).toBe("POTENTIAL")
    expect(scoreToConfidence(40)).toBe("POTENTIAL")
    expect(scoreToConfidence(49)).toBe("POTENTIAL")
  })

  it("returns null for score below 30", () => {
    expect(scoreToConfidence(0)).toBeNull()
    expect(scoreToConfidence(15)).toBeNull()
    expect(scoreToConfidence(29)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildEvaluationPrompt Tests
// ---------------------------------------------------------------------------

describe("buildEvaluationPrompt", () => {
  it("returns system and user messages", () => {
    const prompt = buildEvaluationPrompt(POSTING, CANDIDATE)

    expect(prompt.system).toBeDefined()
    expect(prompt.system.length).toBeGreaterThan(0)
    expect(prompt.prompt).toBeDefined()
    expect(prompt.prompt.length).toBeGreaterThan(0)
  })

  it("includes anti-discrimination guardrails in system prompt", () => {
    const prompt = buildEvaluationPrompt(POSTING, CANDIDATE)

    expect(prompt.system).toMatch(/protected characteristic/i)
    expect(prompt.system).toMatch(/race|gender|age|disability|religion/i)
  })

  it("includes posting data in user prompt", () => {
    const prompt = buildEvaluationPrompt(POSTING, CANDIDATE)

    expect(prompt.prompt).toContain("Software Engineer")
    expect(prompt.prompt).toContain("TypeScript")
  })

  it("includes candidate data in user prompt", () => {
    const prompt = buildEvaluationPrompt(POSTING, CANDIDATE)

    expect(prompt.prompt).toContain("Jane Doe")
    expect(prompt.prompt).toContain("React")
  })
})

// ---------------------------------------------------------------------------
// createProvider Tests
// ---------------------------------------------------------------------------

describe("createProvider", () => {
  it("creates OpenAI provider for openai type", () => {
    createProvider("openai", "sk-test-key")
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: "sk-test-key" })
  })

  it("creates Anthropic provider for anthropic type", () => {
    createProvider("anthropic", "sk-ant-test-key")
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: "sk-ant-test-key" })
  })

  it("throws for unknown provider", () => {
    expect(() => createProvider("unknown", "key")).toThrow(/unsupported/i)
  })
})

// ---------------------------------------------------------------------------
// evaluateCandidate Tests
// ---------------------------------------------------------------------------

describe("evaluateCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns valid evaluation on success", async () => {
    mockGenerateObject.mockResolvedValue({ object: VALID_EVALUATION })

    const result = await evaluateCandidate(POSTING, CANDIDATE, "sk-test", "openai")

    expect(result).not.toBeNull()
    expect(result!.score).toBe(78)
    expect(result!.confidence).toBe("STRONG")
    expect(result!.matchSummary).toContain("strong match")
  })

  it("returns null when LLM returns invalid output", async () => {
    mockGenerateObject.mockResolvedValue({
      object: { score: 200, confidence: "INVALID", matchSummary: "x" },
    })

    const result = await evaluateCandidate(POSTING, CANDIDATE, "sk-test", "openai")

    expect(result).toBeNull()
  })

  it("returns null when generateObject throws", async () => {
    mockGenerateObject.mockRejectedValue(new Error("API rate limit exceeded"))

    const result = await evaluateCandidate(POSTING, CANDIDATE, "sk-test", "openai")

    expect(result).toBeNull()
  })

  it("calls generateObject with correct schema", async () => {
    mockGenerateObject.mockResolvedValue({ object: VALID_EVALUATION })

    await evaluateCandidate(POSTING, CANDIDATE, "sk-test", "openai")

    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
    const call = mockGenerateObject.mock.calls[0]![0]
    expect(call).toHaveProperty("schema")
    expect(call).toHaveProperty("system")
    expect(call).toHaveProperty("prompt")
  })

  it("works with anthropic provider", async () => {
    mockGenerateObject.mockResolvedValue({ object: VALID_EVALUATION })

    const result = await evaluateCandidate(POSTING, CANDIDATE, "sk-ant-test", "anthropic")

    expect(result).not.toBeNull()
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: "sk-ant-test" })
  })
})
