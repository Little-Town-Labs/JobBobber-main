/**
 * Task 4.1 — Matches router procedure tests.
 *
 * Tests all 5 procedures with mocked Prisma and context.
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
  employerMember: { findUnique: vi.fn() },
  jobSeeker: { findUnique: vi.fn().mockResolvedValue(SEEKER) },
  jobPosting: { findUnique: vi.fn() },
  match: {
    findMany: mockMatchFindMany,
    findUnique: mockMatchFindUnique,
    update: mockMatchUpdate,
    count: mockMatchCount,
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
  mockDb.employerMember.findUnique.mockResolvedValue({
    id: "member-1",
    employerId: "emp_01",
    clerkUserId: "user_clerk_01",
    role: "ADMIN",
  })
  mockDb.jobSeeker.findUnique.mockResolvedValue(SEEKER)
})

// ---------------------------------------------------------------------------
// listForPosting
// ---------------------------------------------------------------------------

describe("matches.listForPosting", () => {
  it("returns matches for owned posting", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
    mockMatchFindMany.mockResolvedValue([BASE_MATCH])
    const caller = await makeMatchesCaller()
    const result = await caller.matches.listForPosting({ jobPostingId: "post_01" })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.id).toBe("match_01")
  })

  it("rejects when posting not owned", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "other_emp" })
    const caller = await makeMatchesCaller()
    await expect(caller.matches.listForPosting({ jobPostingId: "post_01" })).rejects.toThrow()
  })

  it("paginates with cursor", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
    const items = Array.from({ length: 3 }, (_, i) => ({
      ...BASE_MATCH,
      id: `match_${i}`,
    }))
    mockMatchFindMany.mockResolvedValue(items)
    const caller = await makeMatchesCaller()
    const result = await caller.matches.listForPosting({
      jobPostingId: "post_01",
      limit: 2,
    })

    expect(result.hasMore).toBe(true)
    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBe("match_1")
  })
})

// ---------------------------------------------------------------------------
// listForSeeker
// ---------------------------------------------------------------------------

describe("matches.listForSeeker", () => {
  it("returns matches for authenticated seeker", async () => {
    mockMatchFindMany.mockResolvedValue([BASE_MATCH])
    const caller = await makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    const result = await caller.matches.listForSeeker()

    expect(result.items).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("matches.getById", () => {
  it("returns match for owning seeker", async () => {
    mockMatchFindUnique.mockResolvedValue(BASE_MATCH)
    const caller = await makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    const result = await caller.matches.getById({ id: "match_01" })

    expect(result).toBeDefined()
    expect(result!.id).toBe("match_01")
  })

  it("returns match for owning employer", async () => {
    mockMatchFindUnique.mockResolvedValue(BASE_MATCH)
    const caller = await makeMatchesCaller()
    const result = await caller.matches.getById({ id: "match_01" })

    expect(result).toBeDefined()
    expect(result!.id).toBe("match_01")
  })

  it("rejects for non-owning seeker", async () => {
    mockMatchFindUnique.mockResolvedValue(BASE_MATCH)
    mockDb.jobSeeker.findUnique.mockResolvedValue({ ...SEEKER, id: "other_seeker" })
    const caller = await makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    await expect(caller.matches.getById({ id: "match_01" })).rejects.toThrow()
  })

  it("returns null for non-existent match", async () => {
    mockMatchFindUnique.mockResolvedValue(null)
    const caller = await makeMatchesCaller()
    const result = await caller.matches.getById({ id: "nope" })
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// updateStatus
// ---------------------------------------------------------------------------

describe("matches.updateStatus", () => {
  it("seeker can accept a PENDING match", async () => {
    mockMatchFindUnique.mockResolvedValue(BASE_MATCH)
    mockMatchUpdate.mockResolvedValue({ ...BASE_MATCH, seekerStatus: "ACCEPTED" })
    const caller = await makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    const result = await caller.matches.updateStatus({ matchId: "match_01", status: "ACCEPTED" })

    expect(result.seekerStatus).toBe("ACCEPTED")
  })

  it("employer can decline a PENDING match", async () => {
    mockMatchFindUnique.mockResolvedValue(BASE_MATCH)
    mockMatchUpdate.mockResolvedValue({ ...BASE_MATCH, employerStatus: "DECLINED" })
    const caller = await makeMatchesCaller()
    const result = await caller.matches.updateStatus({ matchId: "match_01", status: "DECLINED" })

    expect(result.employerStatus).toBe("DECLINED")
  })

  it("rejects changing non-PENDING status", async () => {
    mockMatchFindUnique.mockResolvedValue({ ...BASE_MATCH, seekerStatus: "ACCEPTED" })
    const caller = await makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    await expect(
      caller.matches.updateStatus({ matchId: "match_01", status: "DECLINED" }),
    ).rejects.toThrow("Cannot change status")
  })

  it("mutual accept populates contact info", async () => {
    // Employer already accepted, seeker now accepts
    mockMatchFindUnique.mockResolvedValue({ ...BASE_MATCH, employerStatus: "ACCEPTED" })
    // First update sets seekerStatus, second from populateContactInfo
    mockMatchUpdate
      .mockResolvedValueOnce({
        ...BASE_MATCH,
        seekerStatus: "ACCEPTED",
        employerStatus: "ACCEPTED",
      })
      .mockResolvedValueOnce({
        ...BASE_MATCH,
        seekerStatus: "ACCEPTED",
        employerStatus: "ACCEPTED",
        seekerContactInfo: { name: "Jane", location: "NYC" },
      })
    // jobSeeker.findUnique called by: 1) protectedProcedure ownership check, 2) populateContactInfo
    mockDb.jobSeeker.findUnique
      .mockResolvedValueOnce(SEEKER)
      .mockResolvedValueOnce({ name: "Jane", location: "NYC" })

    const caller = await makeMatchesCaller({
      userId: "user_seeker_01",
      userRole: "JOB_SEEKER",
      orgId: null,
    })
    const result = await caller.matches.updateStatus({ matchId: "match_01", status: "ACCEPTED" })

    expect(result.isMutualAccept).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getWorkflowStatus
// ---------------------------------------------------------------------------

describe("matches.getWorkflowStatus", () => {
  it("returns NOT_STARTED when no conversations", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
    mockConversationFindMany.mockResolvedValue([])
    mockMatchCount.mockResolvedValue(0)

    const caller = await makeMatchesCaller()
    const result = await caller.matches.getWorkflowStatus({ jobPostingId: "post_01" })

    expect(result.status).toBe("NOT_STARTED")
    expect(result.totalCandidates).toBe(0)
    expect(result.matchesCreated).toBe(0)
  })

  it("returns RUNNING when conversations in progress", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
    mockConversationFindMany.mockResolvedValue([
      { status: "IN_PROGRESS" },
      { status: "COMPLETED_MATCH" },
    ])
    mockMatchCount.mockResolvedValue(1)

    const caller = await makeMatchesCaller()
    const result = await caller.matches.getWorkflowStatus({ jobPostingId: "post_01" })

    expect(result.status).toBe("RUNNING")
    expect(result.totalCandidates).toBe(2)
    expect(result.evaluatedCount).toBe(1)
    expect(result.matchesCreated).toBe(1)
  })

  it("returns COMPLETED when all done", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "emp_01" })
    mockConversationFindMany.mockResolvedValue([
      { status: "COMPLETED_MATCH" },
      { status: "COMPLETED_NO_MATCH" },
    ])
    mockMatchCount.mockResolvedValue(1)

    const caller = await makeMatchesCaller()
    const result = await caller.matches.getWorkflowStatus({ jobPostingId: "post_01" })

    expect(result.status).toBe("COMPLETED")
    expect(result.evaluatedCount).toBe(2)
  })

  it("rejects when posting not owned", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ id: "post_01", employerId: "other_emp" })
    const caller = await makeMatchesCaller()
    await expect(caller.matches.getWorkflowStatus({ jobPostingId: "post_01" })).rejects.toThrow()
  })
})
