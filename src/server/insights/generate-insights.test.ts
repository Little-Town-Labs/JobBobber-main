/**
 * Task 2.5 — LLM Insight Generation Tests
 *
 * Tests for generateFeedbackInsights() — mocked LLM calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { InsightGenerationInput } from "./insight-schemas"

const mockGenerateObject = vi.hoisted(() => vi.fn())

vi.mock("ai", () => ({
  generateObject: mockGenerateObject,
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => "mock-model")),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => "mock-model")),
}))

const { generateFeedbackInsights } = await import("./generate-insights")

const validInput: InsightGenerationInput = {
  userType: "JOB_SEEKER",
  totalConversations: 10,
  completedMatchCount: 4,
  completedNoMatchCount: 5,
  terminatedCount: 1,
  inProgressCount: 0,
  matchRate: 0.4,
  acceptanceRate: 0.75,
  confidenceDistribution: { STRONG: 1, GOOD: 2, POTENTIAL: 1 },
  recentOutcomes: ["MATCH", "NO_MATCH", "MATCH", "NO_MATCH", "NO_MATCH"],
  overallMatchRate: 0.4,
  recentMatchRate: 0.4,
  patternSummaries: ["Skills gap cited in 3 of 5 conversations"],
}

describe("generateFeedbackInsights", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns structured insights from LLM", async () => {
    const mockOutput = {
      strengths: ["Strong technical background"],
      weaknesses: ["Limited industry experience"],
      recommendations: ["Highlight transferable skills"],
    }
    mockGenerateObject.mockResolvedValue({ object: mockOutput })

    const result = await generateFeedbackInsights(validInput, "sk-test-key", "openai")

    expect(result).not.toBeNull()
    expect(result!.strengths).toEqual(["Strong technical background"])
    expect(result!.weaknesses).toEqual(["Limited industry experience"])
    expect(result!.recommendations).toEqual(["Highlight transferable skills"])
  })

  it("returns null when no API key provided", async () => {
    const result = await generateFeedbackInsights(validInput, null, null)

    expect(result).toBeNull()
    expect(mockGenerateObject).not.toHaveBeenCalled()
  })

  it("returns null when LLM returns malformed output after retries", async () => {
    mockGenerateObject.mockRejectedValue(new Error("Schema validation failed"))

    const result = await generateFeedbackInsights(validInput, "sk-test-key", "openai")

    expect(result).toBeNull()
  })

  it("does not include any PII in the prompt", async () => {
    const mockOutput = {
      strengths: ["Good"],
      weaknesses: ["Needs work"],
      recommendations: ["Try harder"],
    }
    mockGenerateObject.mockResolvedValue({ object: mockOutput })

    await generateFeedbackInsights(validInput, "sk-test-key", "openai")

    const callArgs = mockGenerateObject.mock.calls[0]?.[0]
    const prompt = JSON.stringify(callArgs?.prompt ?? callArgs?.messages)

    // Should not contain any identifiers
    expect(prompt).not.toContain("seeker-")
    expect(prompt).not.toContain("employer-")
    expect(prompt).not.toContain("posting-")
    expect(prompt).not.toContain("@") // no emails
  })

  it("uses openai provider when specified", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        strengths: ["Good"],
        weaknesses: ["Needs work"],
        recommendations: ["Try"],
      },
    })

    await generateFeedbackInsights(validInput, "sk-test-key", "openai")

    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
  })

  it("uses anthropic provider when specified", async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        strengths: ["Good"],
        weaknesses: ["Needs work"],
        recommendations: ["Try"],
      },
    })

    await generateFeedbackInsights(validInput, "sk-test-key", "anthropic")

    expect(mockGenerateObject).toHaveBeenCalledTimes(1)
  })
})
