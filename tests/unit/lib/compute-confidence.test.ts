/**
 * T1.2 — computeConfidence() tests (RED phase)
 *
 * Tests for the computeConfidence function that will be added to
 * matching-schemas.ts for Feature 10 (Two-Way Matching).
 * This function does not exist yet — all tests should FAIL.
 */
import { describe, it, expect } from "vitest"

import { computeConfidence } from "@/lib/matching-schemas"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DimensionName =
  | "skills_alignment"
  | "experience_fit"
  | "compensation_alignment"
  | "work_arrangement"
  | "culture_fit"
  | "growth_potential"

function makeDimensions(score: number, count: 4 | 6 = 6) {
  const names: DimensionName[] = [
    "skills_alignment",
    "experience_fit",
    "compensation_alignment",
    "work_arrangement",
    "culture_fit",
    "growth_potential",
  ]
  return names.slice(0, count).map((name) => ({
    name,
    score,
    reasoning: "Adequate fit for this dimension",
  }))
}

function makeEval(role: "employer_agent" | "seeker_agent", dimScore: number, dimCount: 4 | 6 = 6) {
  return {
    agentRole: role,
    overallScore: dimScore,
    recommendation: "MATCH" as const,
    reasoning: "Evaluation summary with enough characters to pass validation",
    dimensions: makeDimensions(dimScore, dimCount),
  }
}

function makeEvalWithWeakDimension(
  role: "employer_agent" | "seeker_agent",
  baseScore: number,
  weakName: DimensionName,
  weakScore: number,
) {
  const dims = makeDimensions(baseScore)
  const idx = dims.findIndex((d) => d.name === weakName)
  if (idx !== -1) {
    dims[idx] = { ...dims[idx]!, score: weakScore }
  }
  return {
    agentRole: role,
    overallScore: baseScore,
    recommendation: "MATCH" as const,
    reasoning: "Evaluation summary with enough characters to pass validation",
    dimensions: dims,
  }
}

// ---------------------------------------------------------------------------
// Confidence tier mapping
// ---------------------------------------------------------------------------

describe("computeConfidence — confidence tiers", () => {
  it("returns STRONG when average dimension score >= 75", () => {
    const result = computeConfidence(makeEval("employer_agent", 80), makeEval("seeker_agent", 80))
    expect(result.confidence).toBe("STRONG")
  })

  it("returns GOOD when average dimension score is 55-74", () => {
    const result = computeConfidence(makeEval("employer_agent", 65), makeEval("seeker_agent", 65))
    expect(result.confidence).toBe("GOOD")
  })

  it("returns POTENTIAL when average dimension score is 35-54", () => {
    const result = computeConfidence(makeEval("employer_agent", 45), makeEval("seeker_agent", 45))
    expect(result.confidence).toBe("POTENTIAL")
  })
})

// ---------------------------------------------------------------------------
// Boundary values
// ---------------------------------------------------------------------------

describe("computeConfidence — boundary values", () => {
  it("returns STRONG at exactly 75", () => {
    const result = computeConfidence(makeEval("employer_agent", 75), makeEval("seeker_agent", 75))
    expect(result.confidence).toBe("STRONG")
  })

  it("returns GOOD at exactly 74", () => {
    const result = computeConfidence(makeEval("employer_agent", 74), makeEval("seeker_agent", 74))
    expect(result.confidence).toBe("GOOD")
  })

  it("returns GOOD at exactly 55", () => {
    const result = computeConfidence(makeEval("employer_agent", 55), makeEval("seeker_agent", 55))
    expect(result.confidence).toBe("GOOD")
  })

  it("returns POTENTIAL at exactly 54", () => {
    const result = computeConfidence(makeEval("employer_agent", 54), makeEval("seeker_agent", 54))
    expect(result.confidence).toBe("POTENTIAL")
  })

  it("returns POTENTIAL at exactly 35", () => {
    const result = computeConfidence(makeEval("employer_agent", 35), makeEval("seeker_agent", 35))
    expect(result.confidence).toBe("POTENTIAL")
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("computeConfidence — determinism", () => {
  it("returns identical output for the same input called twice", () => {
    const employer = makeEval("employer_agent", 70)
    const seeker = makeEval("seeker_agent", 70)
    const first = computeConfidence(employer, seeker)
    const second = computeConfidence(employer, seeker)
    expect(first).toEqual(second)
  })
})

// ---------------------------------------------------------------------------
// confidenceInputs structure
// ---------------------------------------------------------------------------

describe("computeConfidence — confidenceInputs", () => {
  it("returns correct averageScore", () => {
    const result = computeConfidence(makeEval("employer_agent", 80), makeEval("seeker_agent", 60))
    // All employer dims = 80, all seeker dims = 60 → average = 70
    expect(result.confidenceInputs.averageScore).toBe(70)
  })

  it("returns correct weakestDimension and weakestScore", () => {
    const result = computeConfidence(
      makeEvalWithWeakDimension("employer_agent", 80, "culture_fit", 30),
      makeEval("seeker_agent", 80),
    )
    expect(result.confidenceInputs.weakestDimension).toBe("culture_fit")
    expect(result.confidenceInputs.weakestScore).toBe(30)
  })

  it("returns correct dimensionCount with 6-dimension evaluations", () => {
    const result = computeConfidence(
      makeEval("employer_agent", 70, 6),
      makeEval("seeker_agent", 70, 6),
    )
    expect(result.confidenceInputs.dimensionCount).toBe(12)
  })

  it("returns correct dimensionCount with 4-dimension evaluations", () => {
    const result = computeConfidence(
      makeEval("employer_agent", 70, 4),
      makeEval("seeker_agent", 70, 4),
    )
    expect(result.confidenceInputs.dimensionCount).toBe(8)
  })

  it("handles evaluations with different numbers of dimensions", () => {
    const result = computeConfidence(
      makeEval("employer_agent", 70, 4),
      makeEval("seeker_agent", 70, 6),
    )
    expect(result.confidenceInputs.dimensionCount).toBe(10)
    expect(result.confidenceInputs.averageScore).toBe(70)
  })
})
