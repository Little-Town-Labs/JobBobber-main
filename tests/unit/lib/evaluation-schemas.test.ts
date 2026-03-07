/**
 * T1.1 — Evaluation Zod Schemas (RED phase)
 *
 * Tests for new evaluation schemas that will be added to
 * conversation-schemas.ts and matching-schemas.ts for Feature 10 (Two-Way Matching).
 * These schemas do not exist yet — all tests should FAIL.
 */
import { describe, it, expect } from "vitest"

import {
  agentDimensionScoreSchema,
  agentEvaluationSchema,
  agentTurnOutputSchema,
} from "@/lib/conversation-schemas"
import { matchEvaluationDataSchema } from "@/lib/matching-schemas"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validDimension = {
  name: "skills_alignment" as const,
  score: 80,
  reasoning: "Strong alignment with required technical skills",
}

function makeDimensions(count: number) {
  const names = [
    "skills_alignment",
    "experience_fit",
    "compensation_alignment",
    "work_arrangement",
    "culture_fit",
    "growth_potential",
  ] as const
  return names.slice(0, count).map((name) => ({
    name,
    score: 70,
    reasoning: "Solid fit for this dimension",
  }))
}

function makeEvaluation(overrides: Record<string, unknown> = {}) {
  return {
    agentRole: "employer_agent",
    overallScore: 75,
    recommendation: "MATCH",
    reasoning: "Overall strong candidate with good alignment across key dimensions",
    dimensions: makeDimensions(6),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// agentDimensionScoreSchema
// ---------------------------------------------------------------------------

describe("agentDimensionScoreSchema", () => {
  const allDimensionNames = [
    "skills_alignment",
    "experience_fit",
    "compensation_alignment",
    "work_arrangement",
    "culture_fit",
    "growth_potential",
  ] as const

  it.each(allDimensionNames)("accepts valid dimension name: %s", (name) => {
    const result = agentDimensionScoreSchema.safeParse({ ...validDimension, name })
    expect(result.success).toBe(true)
  })

  it("rejects an invalid dimension name", () => {
    const result = agentDimensionScoreSchema.safeParse({
      ...validDimension,
      name: "invalid_dimension",
    })
    expect(result.success).toBe(false)
  })

  it("accepts score at lower boundary (0)", () => {
    const result = agentDimensionScoreSchema.safeParse({ ...validDimension, score: 0 })
    expect(result.success).toBe(true)
  })

  it("accepts score at upper boundary (100)", () => {
    const result = agentDimensionScoreSchema.safeParse({ ...validDimension, score: 100 })
    expect(result.success).toBe(true)
  })

  it("rejects score below 0", () => {
    const result = agentDimensionScoreSchema.safeParse({ ...validDimension, score: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects score above 100", () => {
    const result = agentDimensionScoreSchema.safeParse({ ...validDimension, score: 101 })
    expect(result.success).toBe(false)
  })

  it("rejects reasoning shorter than 10 characters", () => {
    const result = agentDimensionScoreSchema.safeParse({
      ...validDimension,
      reasoning: "Too short",
    })
    expect(result.success).toBe(false)
  })

  it("rejects reasoning longer than 200 characters", () => {
    const result = agentDimensionScoreSchema.safeParse({
      ...validDimension,
      reasoning: "x".repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it("accepts reasoning at exactly 10 characters", () => {
    const result = agentDimensionScoreSchema.safeParse({
      ...validDimension,
      reasoning: "x".repeat(10),
    })
    expect(result.success).toBe(true)
  })

  it("accepts reasoning at exactly 200 characters", () => {
    const result = agentDimensionScoreSchema.safeParse({
      ...validDimension,
      reasoning: "x".repeat(200),
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// agentEvaluationSchema
// ---------------------------------------------------------------------------

describe("agentEvaluationSchema", () => {
  it("accepts a valid evaluation with 6 dimensions", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation())
    expect(result.success).toBe(true)
  })

  it("accepts a valid evaluation with 4 dimensions", () => {
    const result = agentEvaluationSchema.safeParse(
      makeEvaluation({ dimensions: makeDimensions(4) }),
    )
    expect(result.success).toBe(true)
  })

  it("rejects fewer than 4 dimensions", () => {
    const result = agentEvaluationSchema.safeParse(
      makeEvaluation({ dimensions: makeDimensions(3) }),
    )
    expect(result.success).toBe(false)
  })

  it("rejects more than 6 dimensions", () => {
    const dims = makeDimensions(6)
    dims.push({ name: "skills_alignment", score: 50, reasoning: "Extra duplicate dimension here" })
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ dimensions: dims }))
    expect(result.success).toBe(false)
  })

  it("accepts overallScore at 0", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ overallScore: 0 }))
    expect(result.success).toBe(true)
  })

  it("accepts overallScore at 100", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ overallScore: 100 }))
    expect(result.success).toBe(true)
  })

  it("rejects overallScore above 100", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ overallScore: 101 }))
    expect(result.success).toBe(false)
  })

  it("rejects reasoning shorter than 20 characters", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ reasoning: "Too short here" }))
    expect(result.success).toBe(false)
  })

  it("rejects reasoning longer than 500 characters", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ reasoning: "x".repeat(501) }))
    expect(result.success).toBe(false)
  })

  it("accepts seeker_agent role", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ agentRole: "seeker_agent" }))
    expect(result.success).toBe(true)
  })

  it("rejects invalid agentRole", () => {
    const result = agentEvaluationSchema.safeParse(makeEvaluation({ agentRole: "unknown_agent" }))
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Extended agentTurnOutputSchema (evaluation on decision turns)
// ---------------------------------------------------------------------------

describe("agentTurnOutputSchema — evaluation extension", () => {
  const baseTurn = {
    content: "After thorough evaluation, I recommend this match.",
    phase: "decision" as const,
  }

  it("rejects decision=MATCH without evaluation", () => {
    const result = agentTurnOutputSchema.safeParse({
      ...baseTurn,
      decision: "MATCH",
    })
    expect(result.success).toBe(false)
  })

  it("rejects decision=NO_MATCH without evaluation", () => {
    const result = agentTurnOutputSchema.safeParse({
      ...baseTurn,
      decision: "NO_MATCH",
    })
    expect(result.success).toBe(false)
  })

  it("accepts decision=CONTINUE without evaluation", () => {
    const result = agentTurnOutputSchema.safeParse({
      ...baseTurn,
      phase: "screening",
      decision: "CONTINUE",
    })
    expect(result.success).toBe(true)
  })

  it("accepts decision=MATCH with valid evaluation", () => {
    const result = agentTurnOutputSchema.safeParse({
      ...baseTurn,
      decision: "MATCH",
      evaluation: makeEvaluation(),
    })
    expect(result.success).toBe(true)
  })

  it("accepts decision=NO_MATCH with valid evaluation", () => {
    const result = agentTurnOutputSchema.safeParse({
      ...baseTurn,
      decision: "NO_MATCH",
      evaluation: makeEvaluation({ recommendation: "NO_MATCH" }),
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// matchEvaluationDataSchema
// ---------------------------------------------------------------------------

describe("matchEvaluationDataSchema", () => {
  it("accepts a valid combined evaluation structure", () => {
    const result = matchEvaluationDataSchema.safeParse({
      employerEvaluation: makeEvaluation({ agentRole: "employer_agent" }),
      seekerEvaluation: makeEvaluation({ agentRole: "seeker_agent" }),
      confidenceInputs: {
        averageScore: 72.5,
        dimensionCount: 12,
        weakestDimension: "compensation_alignment",
        weakestScore: 45,
      },
    })
    expect(result.success).toBe(true)
  })

  it("rejects when employerEvaluation is missing", () => {
    const result = matchEvaluationDataSchema.safeParse({
      seekerEvaluation: makeEvaluation({ agentRole: "seeker_agent" }),
      confidenceInputs: {
        averageScore: 72.5,
        dimensionCount: 12,
        weakestDimension: "compensation_alignment",
        weakestScore: 45,
      },
    })
    expect(result.success).toBe(false)
  })

  it("rejects when confidenceInputs is missing", () => {
    const result = matchEvaluationDataSchema.safeParse({
      employerEvaluation: makeEvaluation({ agentRole: "employer_agent" }),
      seekerEvaluation: makeEvaluation({ agentRole: "seeker_agent" }),
    })
    expect(result.success).toBe(false)
  })
})
