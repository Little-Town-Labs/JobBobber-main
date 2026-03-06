/**
 * Task 1.1: LLM Mock Factory — Tests (TDD RED phase)
 *
 * Tests for the shared LLM mock utility that produces deterministic,
 * Zod-valid responses for AI SDK generateObject calls.
 */
import { describe, it, expect } from "vitest"
import { agentEvaluationSchema } from "@/lib/matching-schemas"
import { createMockGenerateObject } from "./llm-mock"

describe("createMockGenerateObject", () => {
  it("returns a Zod-valid agentEvaluationSchema response by default", async () => {
    const mockFn = createMockGenerateObject()
    const result = await mockFn({ model: "gpt-4", prompt: "evaluate candidate" })

    expect(result).toBeDefined()
    expect(result.object).toBeDefined()

    // Must pass Zod validation
    const parsed = agentEvaluationSchema.safeParse(result.object)
    expect(parsed.success).toBe(true)
  })

  it("allows overriding score", async () => {
    const mockFn = createMockGenerateObject({ score: 95 })
    const result = await mockFn({ model: "gpt-4", prompt: "evaluate" })

    expect(result.object.score).toBe(95)
  })

  it("allows overriding reasoning/matchSummary", async () => {
    const summary = "This candidate is an excellent match for the role."
    const mockFn = createMockGenerateObject({ matchSummary: summary })
    const result = await mockFn({ model: "gpt-4", prompt: "evaluate" })

    expect(result.object.matchSummary).toBe(summary)
  })

  it("allows overriding confidence", async () => {
    const mockFn = createMockGenerateObject({ confidence: "POTENTIAL" })
    const result = await mockFn({ model: "gpt-4", prompt: "evaluate" })

    expect(result.object.confidence).toBe("POTENTIAL")
  })

  it("simulates rate limit error", async () => {
    const mockFn = createMockGenerateObject({ error: "rate_limit" })

    await expect(mockFn({ model: "gpt-4", prompt: "evaluate" })).rejects.toThrow("rate limit")
  })

  it("simulates timeout error", async () => {
    const mockFn = createMockGenerateObject({ error: "timeout" })

    await expect(mockFn({ model: "gpt-4", prompt: "evaluate" })).rejects.toThrow("timeout")
  })

  it("simulates invalid API key error", async () => {
    const mockFn = createMockGenerateObject({ error: "invalid_key" })

    await expect(mockFn({ model: "gpt-4", prompt: "evaluate" })).rejects.toThrow("Invalid")
  })

  it("validates model identifier is non-empty", async () => {
    const mockFn = createMockGenerateObject()

    await expect(mockFn({ model: "", prompt: "evaluate" })).rejects.toThrow("model")
  })

  it("produces valid output for all overridable fields", async () => {
    const mockFn = createMockGenerateObject({
      score: 42,
      confidence: "GOOD",
      matchSummary: "A reasonably good match with some skill gaps noted.",
      strengthAreas: ["TypeScript", "React"],
      gapAreas: ["Kubernetes"],
    })
    const result = await mockFn({ model: "gpt-4", prompt: "evaluate" })

    expect(result.object.score).toBe(42)
    expect(result.object.confidence).toBe("GOOD")
    expect(result.object.strengthAreas).toEqual(["TypeScript", "React"])
    expect(result.object.gapAreas).toEqual(["Kubernetes"])

    const parsed = agentEvaluationSchema.safeParse(result.object)
    expect(parsed.success).toBe(true)
  })
})
