/**
 * Task 2.1 — Insight Schemas Tests
 *
 * Validates Zod schemas for LLM input (aggregated stats) and output
 * (strengths, weaknesses, recommendations).
 */
import { describe, it, expect } from "vitest"
import {
  insightGenerationInputSchema,
  insightGenerationOutputSchema,
  type InsightGenerationInput,
  type InsightGenerationOutput,
} from "./insight-schemas"

describe("insightGenerationInputSchema", () => {
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
    patternSummaries: [
      "Skills gap cited in 3 of 5 no-match outcomes",
      "Strong alignment on location preferences",
    ],
  }

  it("accepts valid aggregation input", () => {
    const result = insightGenerationInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it("requires userType", () => {
    const { userType: _, ...noType } = validInput
    const result = insightGenerationInputSchema.safeParse(noType)
    expect(result.success).toBe(false)
  })

  it("requires totalConversations to be non-negative integer", () => {
    const result = insightGenerationInputSchema.safeParse({
      ...validInput,
      totalConversations: -1,
    })
    expect(result.success).toBe(false)
  })

  it("requires matchRate between 0 and 1", () => {
    expect(insightGenerationInputSchema.safeParse({ ...validInput, matchRate: 1.5 }).success).toBe(
      false,
    )
    expect(insightGenerationInputSchema.safeParse({ ...validInput, matchRate: -0.1 }).success).toBe(
      false,
    )
  })

  it("limits patternSummaries to 10 items", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `Pattern ${i}`)
    const result = insightGenerationInputSchema.safeParse({
      ...validInput,
      patternSummaries: tooMany,
    })
    expect(result.success).toBe(false)
  })

  it("accepts empty patternSummaries", () => {
    const result = insightGenerationInputSchema.safeParse({
      ...validInput,
      patternSummaries: [],
    })
    expect(result.success).toBe(true)
  })
})

describe("insightGenerationOutputSchema", () => {
  const validOutput: InsightGenerationOutput = {
    strengths: ["Strong technical skills", "Good cultural alignment"],
    weaknesses: ["Limited industry experience"],
    recommendations: ["Consider highlighting transferable skills from adjacent industries"],
  }

  it("accepts valid LLM output", () => {
    const result = insightGenerationOutputSchema.safeParse(validOutput)
    expect(result.success).toBe(true)
  })

  it("limits strengths to 5 items", () => {
    const result = insightGenerationOutputSchema.safeParse({
      ...validOutput,
      strengths: Array.from({ length: 6 }, (_, i) => `Strength ${i}`),
    })
    expect(result.success).toBe(false)
  })

  it("limits weaknesses to 5 items", () => {
    const result = insightGenerationOutputSchema.safeParse({
      ...validOutput,
      weaknesses: Array.from({ length: 6 }, (_, i) => `Weakness ${i}`),
    })
    expect(result.success).toBe(false)
  })

  it("limits recommendations to 5 items", () => {
    const result = insightGenerationOutputSchema.safeParse({
      ...validOutput,
      recommendations: Array.from({ length: 6 }, (_, i) => `Rec ${i}`),
    })
    expect(result.success).toBe(false)
  })

  it("enforces max 200 chars per strength", () => {
    const result = insightGenerationOutputSchema.safeParse({
      ...validOutput,
      strengths: ["x".repeat(201)],
    })
    expect(result.success).toBe(false)
  })

  it("enforces max 200 chars per weakness", () => {
    const result = insightGenerationOutputSchema.safeParse({
      ...validOutput,
      weaknesses: ["x".repeat(201)],
    })
    expect(result.success).toBe(false)
  })

  it("enforces max 300 chars per recommendation", () => {
    const result = insightGenerationOutputSchema.safeParse({
      ...validOutput,
      recommendations: ["x".repeat(301)],
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty arrays", () => {
    const result = insightGenerationOutputSchema.safeParse({
      strengths: [],
      weaknesses: [],
      recommendations: [],
    })
    expect(result.success).toBe(false)
  })

  it("accepts minimum valid output (1 item each)", () => {
    const result = insightGenerationOutputSchema.safeParse({
      strengths: ["One strength"],
      weaknesses: ["One area for improvement"],
      recommendations: ["One suggestion"],
    })
    expect(result.success).toBe(true)
  })
})
