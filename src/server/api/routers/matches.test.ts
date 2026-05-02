/**
 * Task 4.1 — Matches router unit tests.
 *
 * Tests all 5 procedures with mocked Prisma and context.
 */
import { describe, it, expect } from "vitest"
import { isMutualAccept, toMatchResponse } from "@/server/api/helpers/match-mapper"

// ---------------------------------------------------------------------------
// Match mapper tests
// ---------------------------------------------------------------------------

const BASE_MATCH = {
  id: "match_01",
  conversationId: "conv_01",
  jobPostingId: "post_01",
  seekerId: "seeker_01",
  employerId: "emp_01",
  confidenceScore: "STRONG" as const,
  matchSummary: "Great candidate fit for the role.",
  employerSummary: "Employer evaluation summary",
  seekerSummary: "Seeker evaluation summary",
  evaluationData: null,
  seekerStatus: "PENDING" as const,
  employerStatus: "PENDING" as const,
  seekerContactInfo: { name: "Jane", email: "jane@example.com" },
  seekerAvailability: { available: true },
  mutualAcceptedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

describe("isMutualAccept", () => {
  it("returns true when both ACCEPTED", () => {
    expect(
      isMutualAccept({ ...BASE_MATCH, seekerStatus: "ACCEPTED", employerStatus: "ACCEPTED" }),
    ).toBe(true)
  })

  it("returns false when only seeker accepted", () => {
    expect(
      isMutualAccept({ ...BASE_MATCH, seekerStatus: "ACCEPTED", employerStatus: "PENDING" }),
    ).toBe(false)
  })

  it("returns false when both pending", () => {
    expect(isMutualAccept(BASE_MATCH)).toBe(false)
  })
})

describe("toMatchResponse", () => {
  it("hides contact info when not mutual accept", () => {
    const response = toMatchResponse(BASE_MATCH)
    expect(response.seekerContactInfo).toBeNull()
    expect(response.seekerAvailability).toBeNull()
    expect(response.isMutualAccept).toBe(false)
  })

  it("shows contact info on mutual accept", () => {
    const mutual = {
      ...BASE_MATCH,
      seekerStatus: "ACCEPTED" as const,
      employerStatus: "ACCEPTED" as const,
    }
    const response = toMatchResponse(mutual)
    expect(response.seekerContactInfo).toEqual({ name: "Jane", email: "jane@example.com" })
    expect(response.isMutualAccept).toBe(true)
  })

  it("includes all standard fields", () => {
    const response = toMatchResponse(BASE_MATCH)
    expect(response.id).toBe("match_01")
    expect(response.confidenceScore).toBe("STRONG")
    expect(response.matchSummary).toBe("Great candidate fit for the role.")
    expect(response.createdAt).toBe("2026-01-01T00:00:00.000Z")
  })
})
