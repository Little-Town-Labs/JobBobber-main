/**
 * Task 2.1 — Enhanced matches router tests (TDD RED phase).
 * Tests extended filters, getForComparison, and bulkUpdateStatus.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let dashboardFlagEnabled = true

const mockJobPostingFindUnique = vi.fn()
const mockMatchFindMany = vi.fn()
const mockMatchUpdateMany = vi.fn()
const mockMatchCount = vi.fn()
const mockLogActivity = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    employer: { findUnique: vi.fn() },
    employerMember: { findUnique: vi.fn() },
    jobPosting: {
      findUnique: (...args: unknown[]) => mockJobPostingFindUnique(...args),
    },
    match: {
      findMany: (...args: unknown[]) => mockMatchFindMany(...args),
      updateMany: (...args: unknown[]) => mockMatchUpdateMany(...args),
      count: (...args: unknown[]) => mockMatchCount(...args),
    },
  },
}))

vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("server-only", () => ({}))

vi.mock("@/lib/activity-log", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}))

vi.mock("@/lib/flags", () => ({
  MATCH_DASHBOARD: () => true,
  ADVANCED_EMPLOYER_DASHBOARD: () => dashboardFlagEnabled,
  assertFlagEnabled: async (flagFn: () => boolean | Promise<boolean>) => {
    const enabled = await flagFn()
    if (!enabled) {
      const { TRPCError } = await import("@trpc/server")
      throw new TRPCError({ code: "NOT_FOUND", message: "This feature is not yet available." })
    }
  },
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: () =>
    Promise.resolve({
      userId: "user_emp",
      orgId: "org_1",
      orgRole: "org:admin",
      sessionClaims: { metadata: { role: "EMPLOYER" } },
    }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPLOYER = { id: "emp_1", clerkOrgId: "org_1", name: "Test Corp" }
const MEMBER = { id: "mem_1", employerId: "emp_1", clerkUserId: "user_emp", role: "ADMIN" }
const POSTING = { id: "post_1", title: "Engineer", status: "ACTIVE", employerId: "emp_1" }

const NOW = new Date("2026-01-01T00:00:00Z")

function createMatch(overrides?: Record<string, unknown>) {
  return {
    id: `match_${Math.random().toString(36).slice(2)}`,
    conversationId: `conv_${Math.random().toString(36).slice(2)}`,
    jobPostingId: "post_1",
    seekerId: `seeker_${Math.random().toString(36).slice(2)}`,
    employerId: "emp_1",
    confidenceScore: "GOOD",
    matchSummary: "Solid match.",
    seekerStatus: "PENDING",
    employerStatus: "PENDING",
    seekerContactInfo: null,
    seekerAvailability: null,
    employerSummary: null,
    seekerSummary: null,
    evaluationData: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

async function makeCaller() {
  const { db } = await import("@/lib/db")
  vi.mocked(db.employer.findUnique).mockResolvedValue(EMPLOYER as never)
  vi.mocked(db.employerMember.findUnique).mockResolvedValue(MEMBER as never)

  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { matchesRouter } = await import("@/server/api/routers/matches")
  const router = createTRPCRouter({ matches: matchesRouter })

  return createCallerFactory(router)({
    db: db as never,
    inngest: null as never,
    userId: "user_emp",
    orgId: "org_1",
    orgRole: "org:admin",
    userRole: "EMPLOYER",
  })
}

// ---------------------------------------------------------------------------
// Tests — listForPosting extended filters
// ---------------------------------------------------------------------------

describe("matches.listForPosting extended filters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dashboardFlagEnabled = true
  })

  it("filters by confidenceLevel", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)
    const strongMatch = createMatch({ confidenceScore: "STRONG" })
    mockMatchFindMany.mockResolvedValue([strongMatch])

    const caller = await makeCaller()
    const result = await caller.matches.listForPosting({
      jobPostingId: "post_1",
      confidenceLevel: ["STRONG"],
    })

    expect(result.items).toHaveLength(1)
    // Verify the where clause includes confidenceScore filter
    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          confidenceScore: { in: ["STRONG"] },
        }),
      }),
    )
  })

  it("filters by multiple confidence levels combined", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)
    mockMatchFindMany.mockResolvedValue([
      createMatch({ confidenceScore: "STRONG" }),
      createMatch({ confidenceScore: "GOOD" }),
    ])

    const caller = await makeCaller()
    await caller.matches.listForPosting({
      jobPostingId: "post_1",
      confidenceLevel: ["STRONG", "GOOD"],
    })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          confidenceScore: { in: ["STRONG", "GOOD"] },
        }),
      }),
    )
  })

  it("existing status and sort filters still work alongside new filters", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)
    mockMatchFindMany.mockResolvedValue([])

    const caller = await makeCaller()
    await caller.matches.listForPosting({
      jobPostingId: "post_1",
      status: "PENDING",
      sort: "newest",
      confidenceLevel: ["STRONG"],
    })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employerStatus: "PENDING",
          confidenceScore: { in: ["STRONG"] },
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — getForComparison
// ---------------------------------------------------------------------------

describe("matches.getForComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dashboardFlagEnabled = true
  })

  it("returns 2-4 matches with joined seeker data", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)

    const matches = [
      createMatch({
        id: "m1",
        seekerId: "s1",
        confidenceScore: "STRONG",
        matchSummary: "Great fit",
        evaluationData: { strengths: ["TypeScript"] },
        seeker: { name: "Alice", skills: ["React", "TS"], location: "NYC" },
      }),
      createMatch({
        id: "m2",
        seekerId: "s2",
        confidenceScore: "GOOD",
        matchSummary: "Good fit",
        evaluationData: null,
        seeker: { name: "Bob", skills: ["Python"], location: "Remote" },
      }),
    ]
    mockMatchFindMany.mockResolvedValue(matches)

    const caller = await makeCaller()
    const result = await caller.matches.getForComparison({
      jobPostingId: "post_1",
      matchIds: ["m1", "m2"],
    })

    expect(result).toHaveLength(2)
    expect(result[0]!.matchId).toBe("m1")
    expect(result[0]!.seekerName).toBe("Alice")
    expect(result[0]!.seekerSkills).toEqual(["React", "TS"])
    expect(result[0]!.confidenceScore).toBe("STRONG")
    expect(result[1]!.matchId).toBe("m2")
    expect(result[1]!.seekerName).toBe("Bob")
  })

  it("validates min 2 match IDs", async () => {
    const caller = await makeCaller()

    await expect(
      caller.matches.getForComparison({
        jobPostingId: "post_1",
        matchIds: ["m1"],
      }),
    ).rejects.toThrow()
  })

  it("validates max 4 match IDs", async () => {
    const caller = await makeCaller()

    await expect(
      caller.matches.getForComparison({
        jobPostingId: "post_1",
        matchIds: ["m1", "m2", "m3", "m4", "m5"],
      }),
    ).rejects.toThrow()
  })

  it("verifies employer owns the posting", async () => {
    mockJobPostingFindUnique.mockResolvedValue({
      ...POSTING,
      employerId: "emp_other",
    })

    const caller = await makeCaller()

    await expect(
      caller.matches.getForComparison({
        jobPostingId: "post_1",
        matchIds: ["m1", "m2"],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws NOT_FOUND when flag is OFF", async () => {
    dashboardFlagEnabled = false
    const caller = await makeCaller()

    await expect(
      caller.matches.getForComparison({
        jobPostingId: "post_1",
        matchIds: ["m1", "m2"],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

// ---------------------------------------------------------------------------
// Tests — bulkUpdateStatus
// ---------------------------------------------------------------------------

describe("matches.bulkUpdateStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dashboardFlagEnabled = true
  })

  it("updates multiple PENDING matches atomically", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)
    mockMatchCount.mockResolvedValue(3) // 3 total requested
    mockMatchUpdateMany.mockResolvedValue({ count: 3 })

    const caller = await makeCaller()
    const result = await caller.matches.bulkUpdateStatus({
      jobPostingId: "post_1",
      matchIds: ["m1", "m2", "m3"],
      status: "ACCEPTED",
    })

    expect(result.updated).toBe(3)
    expect(result.total).toBe(3)
    expect(result.skipped).toBe(0)
  })

  it("skips non-PENDING matches (EC-4)", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)
    mockMatchCount.mockResolvedValue(5) // 5 total requested
    // Only 3 were actually PENDING, so updateMany only updated 3
    mockMatchUpdateMany.mockResolvedValue({ count: 3 })

    const caller = await makeCaller()
    const result = await caller.matches.bulkUpdateStatus({
      jobPostingId: "post_1",
      matchIds: ["m1", "m2", "m3", "m4", "m5"],
      status: "DECLINED",
    })

    expect(result.updated).toBe(3)
    expect(result.skipped).toBe(2) // 5 - 3
    expect(result.total).toBe(5)
  })

  it("returns updated/skipped/total counts", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)
    mockMatchCount.mockResolvedValue(2)
    mockMatchUpdateMany.mockResolvedValue({ count: 1 })

    const caller = await makeCaller()
    const result = await caller.matches.bulkUpdateStatus({
      jobPostingId: "post_1",
      matchIds: ["m1", "m2"],
      status: "ACCEPTED",
    })

    expect(result).toEqual({ updated: 1, skipped: 1, total: 2 })
  })

  it("verifies employer owns the posting", async () => {
    mockJobPostingFindUnique.mockResolvedValue({
      ...POSTING,
      employerId: "emp_other",
    })

    const caller = await makeCaller()

    await expect(
      caller.matches.bulkUpdateStatus({
        jobPostingId: "post_1",
        matchIds: ["m1"],
        status: "ACCEPTED",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("logs activity via logActivity()", async () => {
    mockJobPostingFindUnique.mockResolvedValue(POSTING)
    mockMatchCount.mockResolvedValue(2)
    mockMatchUpdateMany.mockResolvedValue({ count: 2 })

    const caller = await makeCaller()
    await caller.matches.bulkUpdateStatus({
      jobPostingId: "post_1",
      matchIds: ["m1", "m2"],
      status: "ACCEPTED",
    })

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.stringContaining("bulk"),
      }),
    )
  })

  it("throws NOT_FOUND when flag is OFF", async () => {
    dashboardFlagEnabled = false
    const caller = await makeCaller()

    await expect(
      caller.matches.bulkUpdateStatus({
        jobPostingId: "post_1",
        matchIds: ["m1"],
        status: "ACCEPTED",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("validates max 100 match IDs", async () => {
    const caller = await makeCaller()
    const ids = Array.from({ length: 101 }, (_, i) => `m${i}`)

    await expect(
      caller.matches.bulkUpdateStatus({
        jobPostingId: "post_1",
        matchIds: ids,
        status: "ACCEPTED",
      }),
    ).rejects.toThrow()
  })
})
