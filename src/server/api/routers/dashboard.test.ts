/**
 * Task 1.1 — Dashboard router tests (TDD RED phase).
 * Tests getPipelineSummary and getPostingMetrics procedures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let dashboardFlagEnabled = true

const mockMatchGroupBy = vi.fn()
const mockConversationGroupBy = vi.fn()
const mockConversationCount = vi.fn()
const mockJobPostingFindMany = vi.fn()
const mockJobPostingFindUnique = vi.fn()
const mockMatchCount = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    employer: { findUnique: vi.fn() },
    employerMember: { findUnique: vi.fn() },
    match: {
      groupBy: (...args: unknown[]) => mockMatchGroupBy(...args),
      count: (...args: unknown[]) => mockMatchCount(...args),
    },
    agentConversation: {
      groupBy: (...args: unknown[]) => mockConversationGroupBy(...args),
      count: (...args: unknown[]) => mockConversationCount(...args),
    },
    jobPosting: {
      findMany: (...args: unknown[]) => mockJobPostingFindMany(...args),
      findUnique: (...args: unknown[]) => mockJobPostingFindUnique(...args),
    },
  },
}))

vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("server-only", () => ({}))

vi.mock("@/lib/flags", () => ({
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

const EMPLOYER = {
  id: "emp_1",
  clerkOrgId: "org_1",
  name: "Test Corp",
}

const MEMBER = {
  id: "mem_1",
  employerId: "emp_1",
  clerkUserId: "user_emp",
  role: "ADMIN",
}

async function makeCaller() {
  const { db } = await import("@/lib/db")
  vi.mocked(db.employer.findUnique).mockResolvedValue(EMPLOYER as never)
  vi.mocked(db.employerMember.findUnique).mockResolvedValue(MEMBER as never)

  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { dashboardRouter } = await import("@/server/api/routers/dashboard")
  const router = createTRPCRouter({ dashboard: dashboardRouter })

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
// Tests — getPipelineSummary
// ---------------------------------------------------------------------------

describe("dashboard.getPipelineSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dashboardFlagEnabled = true
  })

  it("returns aggregated match counts grouped by posting", async () => {
    mockJobPostingFindMany.mockResolvedValue([
      { id: "post_1", title: "Engineer", status: "ACTIVE", employerId: "emp_1" },
      { id: "post_2", title: "Designer", status: "ACTIVE", employerId: "emp_1" },
    ])

    mockMatchGroupBy.mockResolvedValue([
      { jobPostingId: "post_1", employerStatus: "PENDING", _count: { _all: 5 } },
      { jobPostingId: "post_1", employerStatus: "ACCEPTED", _count: { _all: 3 } },
      { jobPostingId: "post_1", employerStatus: "DECLINED", _count: { _all: 2 } },
      { jobPostingId: "post_2", employerStatus: "PENDING", _count: { _all: 1 } },
    ])

    mockConversationGroupBy.mockResolvedValue([
      { jobPostingId: "post_1", status: "COMPLETED_MATCH", _count: { _all: 10 } },
      { jobPostingId: "post_1", status: "IN_PROGRESS", _count: { _all: 2 } },
      { jobPostingId: "post_2", status: "COMPLETED_NO_MATCH", _count: { _all: 5 } },
      { jobPostingId: "post_2", status: "IN_PROGRESS", _count: { _all: 1 } },
    ])

    const caller = await makeCaller()
    const result = await caller.dashboard.getPipelineSummary()

    expect(result.postings).toHaveLength(2)

    const eng = result.postings.find((p: { id: string }) => p.id === "post_1")!
    expect(eng.title).toBe("Engineer")
    expect(eng.matchCounts.total).toBe(10) // 5+3+2
    expect(eng.matchCounts.pending).toBe(5)
    expect(eng.matchCounts.accepted).toBe(3)
    expect(eng.matchCounts.declined).toBe(2)

    const des = result.postings.find((p: { id: string }) => p.id === "post_2")!
    expect(des.matchCounts.total).toBe(1)
    expect(des.matchCounts.pending).toBe(1)
    expect(des.matchCounts.accepted).toBe(0)
    expect(des.matchCounts.declined).toBe(0)
  })

  it("returns conversation metrics per posting", async () => {
    mockJobPostingFindMany.mockResolvedValue([
      { id: "post_1", title: "Engineer", status: "ACTIVE", employerId: "emp_1" },
    ])

    mockMatchGroupBy.mockResolvedValue([
      { jobPostingId: "post_1", employerStatus: "ACCEPTED", _count: { _all: 8 } },
    ])

    mockConversationGroupBy.mockResolvedValue([
      { jobPostingId: "post_1", status: "COMPLETED_MATCH", _count: { _all: 8 } },
      { jobPostingId: "post_1", status: "COMPLETED_NO_MATCH", _count: { _all: 12 } },
      { jobPostingId: "post_1", status: "IN_PROGRESS", _count: { _all: 3 } },
    ])

    const caller = await makeCaller()
    const result = await caller.dashboard.getPipelineSummary()

    const posting = result.postings[0]!
    expect(posting.conversationMetrics.total).toBe(23) // 8+12+3
    expect(posting.conversationMetrics.inProgress).toBe(3)
    expect(posting.conversationMetrics.completed).toBe(20) // 8+12
  })

  it("calculates match rate percentage per posting", async () => {
    mockJobPostingFindMany.mockResolvedValue([
      { id: "post_1", title: "Engineer", status: "ACTIVE", employerId: "emp_1" },
    ])

    mockMatchGroupBy.mockResolvedValue([
      { jobPostingId: "post_1", employerStatus: "ACCEPTED", _count: { _all: 3 } },
      { jobPostingId: "post_1", employerStatus: "PENDING", _count: { _all: 2 } },
    ])

    // 5 matches out of 20 total evaluations = 25%
    mockConversationGroupBy.mockResolvedValue([
      { jobPostingId: "post_1", status: "COMPLETED_MATCH", _count: { _all: 5 } },
      { jobPostingId: "post_1", status: "COMPLETED_NO_MATCH", _count: { _all: 15 } },
    ])

    const caller = await makeCaller()
    const result = await caller.dashboard.getPipelineSummary()

    // matchRate = matches / completed evaluations * 100
    expect(result.postings[0]!.matchRate).toBe(25)
  })

  it("returns only postings owned by the authenticated employer", async () => {
    mockJobPostingFindMany.mockResolvedValue([
      { id: "post_1", title: "My Post", status: "ACTIVE", employerId: "emp_1" },
    ])
    mockMatchGroupBy.mockResolvedValue([])
    mockConversationGroupBy.mockResolvedValue([])

    const caller = await makeCaller()
    await caller.dashboard.getPipelineSummary()

    // Verify the query filters by employer ID
    expect(mockJobPostingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employerId: "emp_1" }),
      }),
    )
  })

  it("returns totals across all postings", async () => {
    mockJobPostingFindMany.mockResolvedValue([
      { id: "post_1", title: "A", status: "ACTIVE", employerId: "emp_1" },
      { id: "post_2", title: "B", status: "ACTIVE", employerId: "emp_1" },
    ])

    mockMatchGroupBy.mockResolvedValue([
      { jobPostingId: "post_1", employerStatus: "PENDING", _count: { _all: 5 } },
      { jobPostingId: "post_1", employerStatus: "ACCEPTED", _count: { _all: 3 } },
      { jobPostingId: "post_2", employerStatus: "PENDING", _count: { _all: 2 } },
      { jobPostingId: "post_2", employerStatus: "DECLINED", _count: { _all: 1 } },
    ])
    mockConversationGroupBy.mockResolvedValue([])

    const caller = await makeCaller()
    const result = await caller.dashboard.getPipelineSummary()

    expect(result.totals.totalPostings).toBe(2)
    expect(result.totals.totalMatches).toBe(11) // 5+3+2+1
    expect(result.totals.totalPending).toBe(7) // 5+2
    expect(result.totals.totalAccepted).toBe(3)
  })

  it("throws NOT_FOUND when flag is OFF", async () => {
    dashboardFlagEnabled = false
    const caller = await makeCaller()

    await expect(caller.dashboard.getPipelineSummary()).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })

  it("returns empty postings array when employer has no postings", async () => {
    mockJobPostingFindMany.mockResolvedValue([])
    mockMatchGroupBy.mockResolvedValue([])
    mockConversationGroupBy.mockResolvedValue([])

    const caller = await makeCaller()
    const result = await caller.dashboard.getPipelineSummary()

    expect(result.postings).toEqual([])
    expect(result.totals.totalPostings).toBe(0)
    expect(result.totals.totalMatches).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Tests — getPostingMetrics
// ---------------------------------------------------------------------------

describe("dashboard.getPostingMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dashboardFlagEnabled = true
  })

  it("returns conversation and match metrics for a single posting", async () => {
    mockJobPostingFindUnique.mockResolvedValue({
      id: "post_1",
      title: "Engineer",
      status: "ACTIVE",
      employerId: "emp_1",
    })

    mockConversationGroupBy.mockResolvedValue([
      { status: "COMPLETED_MATCH", _count: { _all: 8 } },
      { status: "COMPLETED_NO_MATCH", _count: { _all: 12 } },
      { status: "IN_PROGRESS", _count: { _all: 3 } },
    ])

    mockMatchGroupBy.mockResolvedValue([
      { employerStatus: "PENDING", _count: { _all: 4 } },
      { employerStatus: "ACCEPTED", _count: { _all: 3 } },
      { employerStatus: "DECLINED", _count: { _all: 1 } },
    ])

    const caller = await makeCaller()
    const result = await caller.dashboard.getPostingMetrics({ jobPostingId: "post_1" })

    expect(result.totalConversations).toBe(23)
    expect(result.inProgressConversations).toBe(3)
    expect(result.completedEvaluations).toBe(20)
    expect(result.matchRate).toBe(40) // 8 matches / 20 completed * 100
    expect(result.matchCounts.total).toBe(8)
    expect(result.matchCounts.pending).toBe(4)
    expect(result.matchCounts.accepted).toBe(3)
    expect(result.matchCounts.declined).toBe(1)
  })

  it("verifies employer owns the posting", async () => {
    mockJobPostingFindUnique.mockResolvedValue({
      id: "post_other",
      title: "Other",
      status: "ACTIVE",
      employerId: "emp_other", // Different employer
    })

    const caller = await makeCaller()

    await expect(
      caller.dashboard.getPostingMetrics({ jobPostingId: "post_other" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws NOT_FOUND for non-existent posting", async () => {
    mockJobPostingFindUnique.mockResolvedValue(null)

    const caller = await makeCaller()

    await expect(
      caller.dashboard.getPostingMetrics({ jobPostingId: "nonexistent" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("returns zero-state metrics for a posting with no data", async () => {
    mockJobPostingFindUnique.mockResolvedValue({
      id: "post_new",
      title: "New Post",
      status: "ACTIVE",
      employerId: "emp_1",
    })

    mockConversationGroupBy.mockResolvedValue([])
    mockMatchGroupBy.mockResolvedValue([])

    const caller = await makeCaller()
    const result = await caller.dashboard.getPostingMetrics({ jobPostingId: "post_new" })

    expect(result.totalConversations).toBe(0)
    expect(result.inProgressConversations).toBe(0)
    expect(result.completedEvaluations).toBe(0)
    expect(result.matchRate).toBe(0)
    expect(result.matchCounts.total).toBe(0)
    expect(result.matchCounts.pending).toBe(0)
    expect(result.matchCounts.accepted).toBe(0)
    expect(result.matchCounts.declined).toBe(0)
  })

  it("throws NOT_FOUND when flag is OFF", async () => {
    dashboardFlagEnabled = false
    const caller = await makeCaller()

    await expect(
      caller.dashboard.getPostingMetrics({ jobPostingId: "post_1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
