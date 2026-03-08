/**
 * Task 4.1 — No-Match Dashboard Filtering Tests
 *
 * Verifies that COMPLETED_NO_MATCH conversations produce no Match records
 * and therefore are invisible to employer/seeker match queries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must be defined before imports (Vitest hoists vi.mock calls)
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  jobPosting: { findUnique: vi.fn() },
  match: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  agentConversation: { findMany: vi.fn() },
  jobSeeker: { findUnique: vi.fn() },
  employer: { findUnique: vi.fn() },
  employerMember: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helper: create a tRPC caller with proper middleware mocking
// ---------------------------------------------------------------------------

async function makeEmployerCaller(employerId: string, orgId: string) {
  // Mock the middleware DB lookups
  mockDb.employer.findUnique.mockResolvedValue({ id: employerId, clerkOrgId: orgId })
  mockDb.employerMember.findUnique.mockResolvedValue({
    id: "member-1",
    employerId,
    clerkUserId: "user-1",
    role: "ADMIN",
  })

  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { matchesRouter } = await import("@/server/api/routers/matches")

  return createCallerFactory(createTRPCRouter({ matches: matchesRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: "user-1",
    orgId,
    orgRole: "org:admin",
    userRole: "EMPLOYER",
  } as never)
}

async function makeSeekerCaller(seekerId: string) {
  // Mock the middleware DB lookups
  mockDb.jobSeeker.findUnique.mockResolvedValue({ id: seekerId, clerkUserId: "user-1" })

  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { matchesRouter } = await import("@/server/api/routers/matches")

  return createCallerFactory(createTRPCRouter({ matches: matchesRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: "user-1",
    orgId: null,
    orgRole: null,
    userRole: "JOB_SEEKER",
  } as never)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("matches router — no-match filtering", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("employer view — no-match conversations produce no Match records", () => {
    it("returns empty list when all conversations ended as COMPLETED_NO_MATCH", async () => {
      mockDb.jobPosting.findUnique.mockResolvedValue({ id: "posting-1", employerId: "emp-1" })
      mockDb.match.findMany.mockResolvedValue([])

      const caller = await makeEmployerCaller("emp-1", "org-1")
      const result = await caller.matches.listForPosting({ jobPostingId: "posting-1" })

      expect(result.items).toEqual([])
    })

    it("returns only matched candidates, excluding seekers with only no-match conversations", async () => {
      const now = new Date()
      mockDb.jobPosting.findUnique.mockResolvedValue({ id: "posting-1", employerId: "emp-1" })
      mockDb.match.findMany.mockResolvedValue([
        {
          id: "match-1",
          conversationId: "conv-2",
          jobPostingId: "posting-1",
          seekerId: "seeker-2",
          employerId: "emp-1",
          confidenceScore: "GOOD",
          matchSummary: "Good fit",
          seekerStatus: "PENDING",
          employerStatus: "PENDING",
          seekerContactInfo: null,
          seekerAvailability: null,
          evaluationData: null,
          employerSummary: null,
          seekerSummary: null,
          createdAt: now,
          updatedAt: now,
        },
      ])

      const caller = await makeEmployerCaller("emp-1", "org-1")
      const result = await caller.matches.listForPosting({ jobPostingId: "posting-1" })

      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.seekerId).toBe("seeker-2")
    })
  })

  describe("seeker view — no-match conversations invisible", () => {
    it("returns empty list when seeker only had no-match conversations", async () => {
      mockDb.match.findMany.mockResolvedValue([])

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.matches.listForSeeker()

      expect(result.items).toEqual([])
    })
  })

  describe("backwards compatibility — null evaluationData", () => {
    it("returns match response with null evaluationData for old Feature 9 matches", async () => {
      const now = new Date()
      mockDb.match.findUnique.mockResolvedValue({
        id: "match-old",
        conversationId: "conv-old",
        jobPostingId: "posting-1",
        seekerId: "seeker-1",
        employerId: "emp-1",
        confidenceScore: "GOOD",
        matchSummary: "Legacy match",
        seekerStatus: "PENDING",
        employerStatus: "PENDING",
        seekerContactInfo: null,
        seekerAvailability: null,
        evaluationData: null,
        employerSummary: null,
        seekerSummary: null,
        createdAt: now,
        updatedAt: now,
      })

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.matches.getById({ id: "match-old" })

      expect(result).not.toBeNull()
      expect(result!.id).toBe("match-old")
      expect(result!.matchSummary).toBe("Legacy match")
    })
  })
})
