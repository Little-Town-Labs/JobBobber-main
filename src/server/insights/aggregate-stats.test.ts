/**
 * Task 2.3 — Aggregate Statistics Tests
 *
 * Tests for buildSeekerInsightContext() and buildEmployerInsightContext().
 * Privacy-critical: verifies no PII leaks into aggregation output.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { insightGenerationInputSchema } from "./insight-schemas"

const mockDb = vi.hoisted(() => ({
  agentConversation: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  match: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  jobPosting: {
    findMany: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

// Import after mocks
const { buildSeekerInsightContext, buildEmployerInsightContext } = await import("./aggregate-stats")

describe("buildSeekerInsightContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("computes correct statistics from conversation data", async () => {
    mockDb.agentConversation.findMany.mockResolvedValue([
      { status: "COMPLETED_MATCH", completedAt: new Date("2026-03-01") },
      { status: "COMPLETED_MATCH", completedAt: new Date("2026-03-02") },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date("2026-03-03") },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date("2026-03-04") },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date("2026-03-05") },
      { status: "IN_PROGRESS", completedAt: null },
    ])
    mockDb.match.groupBy.mockResolvedValue([
      { confidenceScore: "STRONG", _count: { _all: 1 } },
      { confidenceScore: "GOOD", _count: { _all: 1 } },
    ])
    mockDb.match.findMany.mockResolvedValue([
      { seekerStatus: "ACCEPTED", employerStatus: "ACCEPTED" },
      { seekerStatus: "PENDING", employerStatus: "ACCEPTED" },
    ])

    const result = await buildSeekerInsightContext("seeker-1")

    expect(result.userType).toBe("JOB_SEEKER")
    expect(result.totalConversations).toBe(6)
    expect(result.completedMatchCount).toBe(2)
    expect(result.completedNoMatchCount).toBe(3)
    expect(result.inProgressCount).toBe(1)
    expect(result.matchRate).toBeCloseTo(0.4) // 2 match / 5 completed
    expect(result.confidenceDistribution).toEqual({ STRONG: 1, GOOD: 1, POTENTIAL: 0 })
  })

  it("returns schema-valid output", async () => {
    mockDb.agentConversation.findMany.mockResolvedValue([
      { status: "COMPLETED_MATCH", completedAt: new Date() },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
    ])
    mockDb.match.groupBy.mockResolvedValue([{ confidenceScore: "GOOD", _count: { _all: 1 } }])
    mockDb.match.findMany.mockResolvedValue([
      { seekerStatus: "PENDING", employerStatus: "PENDING" },
    ])

    const result = await buildSeekerInsightContext("seeker-1")
    const parsed = insightGenerationInputSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it("handles zero conversations", async () => {
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    const result = await buildSeekerInsightContext("seeker-1")

    expect(result.totalConversations).toBe(0)
    expect(result.matchRate).toBe(0)
    expect(result.recentOutcomes).toEqual([])
  })

  it("handles all no-match conversations", async () => {
    mockDb.agentConversation.findMany.mockResolvedValue([
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
    ])
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    const result = await buildSeekerInsightContext("seeker-1")

    expect(result.matchRate).toBe(0)
    expect(result.completedMatchCount).toBe(0)
    expect(result.completedNoMatchCount).toBe(3)
  })

  it("calculates recent outcomes from last 5 completed conversations", async () => {
    const conversations = [
      { status: "COMPLETED_MATCH", completedAt: new Date("2026-03-01") },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date("2026-03-02") },
      { status: "COMPLETED_MATCH", completedAt: new Date("2026-03-03") },
      { status: "COMPLETED_MATCH", completedAt: new Date("2026-03-04") },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date("2026-03-05") },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date("2026-03-06") },
      { status: "COMPLETED_MATCH", completedAt: new Date("2026-03-07") },
    ]
    mockDb.agentConversation.findMany.mockResolvedValue(conversations)
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    const result = await buildSeekerInsightContext("seeker-1")

    expect(result.recentOutcomes).toHaveLength(5)
  })

  it("caps conversation analysis at MAX_CONVERSATIONS_FOR_PATTERNS", async () => {
    // Verify the findMany call uses a take limit
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    await buildSeekerInsightContext("seeker-1")

    const findManyCall = mockDb.agentConversation.findMany.mock.calls[0]?.[0]
    expect(findManyCall?.take).toBeLessThanOrEqual(50)
  })

  // PRIVACY TESTS
  it("output contains no user IDs or names", async () => {
    mockDb.agentConversation.findMany.mockResolvedValue([
      { status: "COMPLETED_MATCH", completedAt: new Date() },
    ])
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    const result = await buildSeekerInsightContext("seeker-1")
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain("seeker-1")
    expect(serialized).not.toContain("employer")
    expect(serialized).not.toContain("name")
  })
})

describe("buildEmployerInsightContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("aggregates across all employer postings", async () => {
    mockDb.jobPosting.findMany.mockResolvedValue([{ id: "posting-1" }, { id: "posting-2" }])
    mockDb.agentConversation.findMany.mockResolvedValue([
      { status: "COMPLETED_MATCH", completedAt: new Date() },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
      { status: "COMPLETED_MATCH", completedAt: new Date() },
    ])
    mockDb.match.groupBy.mockResolvedValue([
      { confidenceScore: "STRONG", _count: { _all: 1 } },
      { confidenceScore: "GOOD", _count: { _all: 1 } },
    ])
    mockDb.match.findMany.mockResolvedValue([
      { employerStatus: "ACCEPTED", seekerStatus: "ACCEPTED" },
      { employerStatus: "PENDING", seekerStatus: "PENDING" },
    ])

    const result = await buildEmployerInsightContext("emp-1")

    expect(result.userType).toBe("EMPLOYER")
    expect(result.totalConversations).toBe(3)
    expect(result.completedMatchCount).toBe(2)
  })

  it("returns schema-valid output", async () => {
    mockDb.jobPosting.findMany.mockResolvedValue([{ id: "posting-1" }])
    mockDb.agentConversation.findMany.mockResolvedValue([
      { status: "COMPLETED_MATCH", completedAt: new Date() },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
      { status: "COMPLETED_NO_MATCH", completedAt: new Date() },
    ])
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    const result = await buildEmployerInsightContext("emp-1")
    const parsed = insightGenerationInputSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it("scopes to specific posting when jobPostingId provided", async () => {
    mockDb.agentConversation.findMany.mockResolvedValue([])
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    await buildEmployerInsightContext("emp-1", "posting-1")

    const convCall = mockDb.agentConversation.findMany.mock.calls[0]?.[0]
    expect(convCall?.where?.jobPostingId).toBe("posting-1")
  })

  // PRIVACY TEST
  it("output contains no employer or posting IDs", async () => {
    mockDb.jobPosting.findMany.mockResolvedValue([{ id: "posting-1" }])
    mockDb.agentConversation.findMany.mockResolvedValue([
      { status: "COMPLETED_MATCH", completedAt: new Date() },
    ])
    mockDb.match.groupBy.mockResolvedValue([])
    mockDb.match.findMany.mockResolvedValue([])

    const result = await buildEmployerInsightContext("emp-1")
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain("emp-1")
    expect(serialized).not.toContain("posting-1")
  })
})
