/**
 * Task 1.1 — Match Dashboard extended procedure tests.
 *
 * Tests new filtering, sorting, and count procedures for Feature 6.
 * These tests are expected to FAIL until the procedures are implemented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

const mockMatchFindMany = vi.fn()
const mockMatchFindUnique = vi.fn()
const mockMatchUpdate = vi.fn()
const mockMatchCount = vi.fn()
const mockMatchGroupBy = vi.fn()
const mockConversationFindMany = vi.fn()

const EMPLOYER = {
  id: "emp_01",
  clerkOrgId: "org_clerk_01",
  name: "Acme Corp",
  industry: "Technology",
  size: "51-200",
  description: "We build things",
  culture: null,
  headquarters: null,
  locations: [],
  websiteUrl: null,
  urls: {},
  benefits: [],
  logoUrl: null,
  byokApiKeyEncrypted: null,
  byokProvider: null,
  byokKeyValidatedAt: null,
  byokMaskedKey: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const SEEKER = {
  id: "seeker_01",
  clerkUserId: "user_seeker_01",
  name: "Jane Doe",
  headline: "Engineer",
  skills: ["TypeScript"],
  experience: [],
  education: [],
  location: "NYC",
  profileCompleteness: 80,
  isActive: true,
  resumeUrl: null,
  resumeOriginalName: null,
  resumeParsedData: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const mockDb = {
  employer: { findUnique: vi.fn().mockResolvedValue(EMPLOYER) },
  jobSeeker: { findUnique: vi.fn().mockResolvedValue(SEEKER) },
  jobPosting: { findUnique: vi.fn() },
  match: {
    findMany: mockMatchFindMany,
    findUnique: mockMatchFindUnique,
    update: mockMatchUpdate,
    count: mockMatchCount,
    groupBy: mockMatchGroupBy,
  },
  agentConversation: { findMany: mockConversationFindMany },
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const BASE_MATCH = {
  id: "match_01",
  conversationId: "conv_01",
  jobPostingId: "post_01",
  seekerId: "seeker_01",
  employerId: "emp_01",
  confidenceScore: "STRONG" as const,
  matchSummary: "Great fit.",
  seekerStatus: "PENDING" as const,
  employerStatus: "PENDING" as const,
  seekerContactInfo: null,
  seekerAvailability: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

async function makeMatchesCaller(ctx?: {
  userId?: string | null
  orgId?: string | null
  orgRole?: "org:admin" | "org:member" | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { matchesRouter } = await import("@/server/api/routers/matches")

  return createCallerFactory(createTRPCRouter({ matches: matchesRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx?.userId ?? "user_clerk_01",
    orgId: ctx?.orgId ?? "org_clerk_01",
    orgRole: ctx?.orgRole ?? "org:admin",
    userRole: ctx?.userRole ?? "EMPLOYER",
    hasByokKey: false,
    employer: EMPLOYER as never,
    seeker: SEEKER as never,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.employer.findUnique.mockResolvedValue(EMPLOYER)
  mockDb.jobSeeker.findUnique.mockResolvedValue(SEEKER)
})

// ---------------------------------------------------------------------------
// listForSeeker with status filter
// ---------------------------------------------------------------------------

describe("matches.listForSeeker with status filter", () => {
  const makeSeekerCaller = () =>
    makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })

  it("filters by status PENDING", async () => {
    mockMatchFindMany.mockResolvedValue([BASE_MATCH])
    const caller = await makeSeekerCaller()
    await caller.matches.listForSeeker({ status: "PENDING" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seekerId: "seeker_01",
          seekerStatus: "PENDING",
        }),
      }),
    )
  })

  it("filters by status ACCEPTED", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeSeekerCaller()
    await caller.matches.listForSeeker({ status: "ACCEPTED" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seekerId: "seeker_01",
          seekerStatus: "ACCEPTED",
        }),
      }),
    )
  })

  it("filters by status DECLINED", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeSeekerCaller()
    await caller.matches.listForSeeker({ status: "DECLINED" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seekerId: "seeker_01",
          seekerStatus: "DECLINED",
        }),
      }),
    )
  })

  it("does not filter by status when not provided", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeSeekerCaller()
    await caller.matches.listForSeeker()

    const callArgs = mockMatchFindMany.mock.calls[0]![0] as {
      where: Record<string, unknown>
    }
    expect(callArgs.where).not.toHaveProperty("seekerStatus")
  })
})

// ---------------------------------------------------------------------------
// listForSeeker with sort
// ---------------------------------------------------------------------------

describe("matches.listForSeeker with sort", () => {
  const makeSeekerCaller = () =>
    makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })

  it("sorts by confidenceScore desc when sort is confidence", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeSeekerCaller()
    await caller.matches.listForSeeker({ sort: "confidence" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { confidenceScore: "desc" },
      }),
    )
  })

  it("sorts by createdAt desc when sort is newest", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeSeekerCaller()
    await caller.matches.listForSeeker({ sort: "newest" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    )
  })

  it("defaults to confidence sort when sort not provided", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeSeekerCaller()
    await caller.matches.listForSeeker()

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { confidenceScore: "desc" },
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// listForPosting with status filter
// ---------------------------------------------------------------------------

describe("matches.listForPosting with status filter", () => {
  beforeEach(() => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
  })

  it("filters by employerStatus PENDING", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeMatchesCaller()
    await caller.matches.listForPosting({ jobPostingId: "post_01", status: "PENDING" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          jobPostingId: "post_01",
          employerStatus: "PENDING",
        }),
      }),
    )
  })

  it("filters by employerStatus ACCEPTED", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeMatchesCaller()
    await caller.matches.listForPosting({ jobPostingId: "post_01", status: "ACCEPTED" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          jobPostingId: "post_01",
          employerStatus: "ACCEPTED",
        }),
      }),
    )
  })

  it("filters by employerStatus DECLINED", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeMatchesCaller()
    await caller.matches.listForPosting({ jobPostingId: "post_01", status: "DECLINED" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          jobPostingId: "post_01",
          employerStatus: "DECLINED",
        }),
      }),
    )
  })

  it("does not filter by employerStatus when status not provided", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeMatchesCaller()
    await caller.matches.listForPosting({ jobPostingId: "post_01" })

    const callArgs = mockMatchFindMany.mock.calls[0]![0] as {
      where: Record<string, unknown>
    }
    expect(callArgs.where).not.toHaveProperty("employerStatus")
  })
})

// ---------------------------------------------------------------------------
// listForPosting with sort
// ---------------------------------------------------------------------------

describe("matches.listForPosting with sort", () => {
  beforeEach(() => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
  })

  it("sorts by confidenceScore desc when sort is confidence", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeMatchesCaller()
    await caller.matches.listForPosting({ jobPostingId: "post_01", sort: "confidence" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { confidenceScore: "desc" },
      }),
    )
  })

  it("sorts by createdAt desc when sort is newest", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeMatchesCaller()
    await caller.matches.listForPosting({ jobPostingId: "post_01", sort: "newest" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    )
  })

  it("defaults to confidence sort when sort not provided", async () => {
    mockMatchFindMany.mockResolvedValue([])
    const caller = await makeMatchesCaller()
    await caller.matches.listForPosting({ jobPostingId: "post_01" })

    expect(mockMatchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { confidenceScore: "desc" },
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// getStatusCounts (seeker)
// ---------------------------------------------------------------------------

describe("matches.getStatusCounts", () => {
  const makeSeekerCaller = () =>
    makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })

  it("returns counts grouped by seekerStatus", async () => {
    mockMatchCount.mockResolvedValue(5)
    mockMatchGroupBy.mockResolvedValue([
      { seekerStatus: "PENDING", _count: { _all: 3 } },
      { seekerStatus: "ACCEPTED", _count: { _all: 1 } },
      { seekerStatus: "DECLINED", _count: { _all: 1 } },
    ])

    const caller = await makeSeekerCaller()
    const result = await caller.matches.getStatusCounts()

    expect(result).toEqual({
      all: 5,
      pending: 3,
      accepted: 1,
      declined: 1,
    })
  })

  it("returns zeros when no matches exist", async () => {
    mockMatchCount.mockResolvedValue(0)
    mockMatchGroupBy.mockResolvedValue([])

    const caller = await makeSeekerCaller()
    const result = await caller.matches.getStatusCounts()

    expect(result).toEqual({
      all: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
    })
  })

  it("uses ctx.seeker.id to scope the counts", async () => {
    mockMatchCount.mockResolvedValue(0)
    mockMatchGroupBy.mockResolvedValue([])

    const caller = await makeSeekerCaller()
    await caller.matches.getStatusCounts()

    expect(mockMatchCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seekerId: "seeker_01" },
      }),
    )
    expect(mockMatchGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seekerId: "seeker_01" },
        by: ["seekerStatus"],
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// getPostingStatusCounts (employer)
// ---------------------------------------------------------------------------

describe("matches.getPostingStatusCounts", () => {
  beforeEach(() => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
  })

  it("returns counts grouped by employerStatus", async () => {
    mockMatchCount.mockResolvedValue(4)
    mockMatchGroupBy.mockResolvedValue([
      { employerStatus: "PENDING", _count: { _all: 2 } },
      { employerStatus: "ACCEPTED", _count: { _all: 1 } },
      { employerStatus: "DECLINED", _count: { _all: 1 } },
    ])

    const caller = await makeMatchesCaller()
    const result = await caller.matches.getPostingStatusCounts({ jobPostingId: "post_01" })

    expect(result).toEqual({
      all: 4,
      pending: 2,
      accepted: 1,
      declined: 1,
    })
  })

  it("returns zeros when no matches exist for posting", async () => {
    mockMatchCount.mockResolvedValue(0)
    mockMatchGroupBy.mockResolvedValue([])

    const caller = await makeMatchesCaller()
    const result = await caller.matches.getPostingStatusCounts({ jobPostingId: "post_01" })

    expect(result).toEqual({
      all: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
    })
  })

  it("verifies employer owns the posting", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "other_emp" })

    const caller = await makeMatchesCaller()
    await expect(
      caller.matches.getPostingStatusCounts({ jobPostingId: "post_01" }),
    ).rejects.toThrow()
  })

  it("scopes counts to the jobPostingId", async () => {
    mockMatchCount.mockResolvedValue(0)
    mockMatchGroupBy.mockResolvedValue([])

    const caller = await makeMatchesCaller()
    await caller.matches.getPostingStatusCounts({ jobPostingId: "post_01" })

    expect(mockMatchCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobPostingId: "post_01" },
      }),
    )
    expect(mockMatchGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobPostingId: "post_01" },
        by: ["employerStatus"],
      }),
    )
  })
})
