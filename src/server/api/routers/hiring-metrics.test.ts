/**
 * Task 2.1 — Hiring metrics router unit tests (TDD: written first).
 *
 * Tests getHiringMetrics, exportCsv, and isEnabled procedures.
 * All Prisma calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// First test cold-starts dynamic imports (~8–15s on WSL under full-suite load)
vi.setConfig({ testTimeout: 30_000 })

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  jobPosting: {
    findMany: vi.fn(),
  },
  employer: {
    findUnique: vi.fn().mockResolvedValue({ id: "emp_01", clerkOrgId: "org_01" }),
  },
  employerMember: {
    findUnique: vi
      .fn()
      .mockResolvedValue({ employerId: "emp_01", clerkUserId: "user_01", role: "ADMIN" }),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const mockFlagValue = vi.hoisted(() => ({ value: true }))
vi.mock("@/lib/flags", () => ({
  HIRING_METRICS: () => mockFlagValue.value,
  assertFlagEnabled: vi.fn(async (flagFn: () => boolean) => {
    const enabled = await flagFn()
    if (!enabled) {
      const { TRPCError } = await import("@trpc/server")
      throw new TRPCError({ code: "NOT_FOUND", message: "This feature is not yet available." })
    }
  }),
}))

// ---------------------------------------------------------------------------
// Helper: create tRPC caller with employer context
// ---------------------------------------------------------------------------

async function makeCaller() {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { hiringMetricsRouter } = await import("./hiring-metrics")

  return createCallerFactory(createTRPCRouter({ hiringMetrics: hiringMetricsRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: "user_01",
    orgId: "org_01",
    orgRole: "org:admin",
    userRole: "EMPLOYER",
    employer: { id: "emp_01", clerkOrgId: "org_01" },
    member: { clerkUserId: "user_01", role: "ADMIN" },
  } as never)
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makePosting(
  overrides: {
    id?: string
    title?: string
    status?: string
    createdAt?: Date
    matches?: Array<{
      createdAt: Date
      mutualAcceptedAt: Date | null
      seekerStatus: string
      employerStatus: string
    }>
  } = {},
) {
  return {
    id: overrides.id ?? "post_01",
    title: overrides.title ?? "Software Engineer",
    status: overrides.status ?? "ACTIVE",
    createdAt: overrides.createdAt ?? new Date("2026-01-15"),
    employerId: "emp_01",
    matches: overrides.matches ?? [],
  }
}

function makeMatch(overrides: {
  createdAt?: Date
  mutualAcceptedAt?: Date | null
  seekerStatus?: string
  employerStatus?: string
}) {
  return {
    createdAt: overrides.createdAt ?? new Date("2026-01-16"),
    mutualAcceptedAt: overrides.mutualAcceptedAt ?? null,
    seekerStatus: overrides.seekerStatus ?? "PENDING",
    employerStatus: overrides.employerStatus ?? "PENDING",
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("hiringMetrics router", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFlagValue.value = true
  })

  describe("getHiringMetrics", () => {
    it("returns empty state when no postings exist", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([])
      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      expect(result.postings).toEqual([])
      expect(result.aggregates.totalPostings).toBe(0)
      expect(result.aggregates.totalMatches).toBe(0)
      expect(result.aggregates.avgTimeToFirstMatchMs).toBeNull()
      expect(result.aggregates.avgTimeToMutualAcceptMs).toBeNull()
      expect(result.windowDays).toBe(30)
    })

    it("computes time-to-first-match correctly", async () => {
      const postingDate = new Date("2026-01-15T00:00:00Z")
      const matchDate = new Date("2026-01-16T00:00:00Z") // 24h later

      mockDb.jobPosting.findMany.mockResolvedValue([
        makePosting({
          createdAt: postingDate,
          matches: [makeMatch({ createdAt: matchDate })],
        }),
      ])

      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      const posting = result.postings[0]!
      expect(posting.timeToFirstMatchMs).toBe(24 * 60 * 60 * 1000)
      expect(posting.firstMatchAt).toEqual(matchDate)
    })

    it("computes time-to-mutual-accept using mutualAcceptedAt", async () => {
      const postingDate = new Date("2026-01-15T00:00:00Z")
      const matchDate = new Date("2026-01-16T00:00:00Z")
      const acceptDate = new Date("2026-01-20T00:00:00Z") // 5 days after posting

      mockDb.jobPosting.findMany.mockResolvedValue([
        makePosting({
          createdAt: postingDate,
          matches: [
            makeMatch({
              createdAt: matchDate,
              mutualAcceptedAt: acceptDate,
              seekerStatus: "ACCEPTED",
              employerStatus: "ACCEPTED",
            }),
          ],
        }),
      ])

      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      const posting = result.postings[0]!
      expect(posting.timeToMutualAcceptMs).toBe(5 * 24 * 60 * 60 * 1000)
      expect(posting.firstMutualAcceptAt).toEqual(acceptDate)
    })

    it("excludes zero-match postings from averages", async () => {
      const postingDate = new Date("2026-01-15T00:00:00Z")
      const matchDate = new Date("2026-01-16T00:00:00Z")

      mockDb.jobPosting.findMany.mockResolvedValue([
        makePosting({
          id: "post_with_matches",
          createdAt: postingDate,
          matches: [makeMatch({ createdAt: matchDate })],
        }),
        makePosting({
          id: "post_no_matches",
          createdAt: postingDate,
          matches: [],
        }),
      ])

      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      expect(result.aggregates.totalPostings).toBe(2)
      expect(result.aggregates.postingsWithMatches).toBe(1)
      // Average should only consider the posting with matches
      expect(result.aggregates.avgTimeToFirstMatchMs).toBe(24 * 60 * 60 * 1000)
    })

    it("accepts 30, 60, and 90 day window values", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([])
      const caller = await makeCaller()

      for (const windowDays of [30, 60, 90] as const) {
        const result = await caller.hiringMetrics.getHiringMetrics({ windowDays })
        expect(result.windowDays).toBe(windowDays)
      }
    })

    it("fetches previous period for trend comparison", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([])
      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      // Two findMany calls: current window + previous window
      expect(mockDb.jobPosting.findMany).toHaveBeenCalledTimes(2)
      expect(result.previousPeriod).toBeDefined()
      expect(result.previousPeriod.totalPostings).toBe(0)
    })

    it("computes improving trend when current is better", async () => {
      const now = new Date()
      const currentPostingDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      const prevPostingDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)

      // Current: fast match (1 day), Previous: slow match (5 days)
      mockDb.jobPosting.findMany
        .mockResolvedValueOnce([
          makePosting({
            createdAt: currentPostingDate,
            matches: [
              makeMatch({
                createdAt: new Date(currentPostingDate.getTime() + 1 * 24 * 60 * 60 * 1000),
              }),
            ],
          }),
        ])
        .mockResolvedValueOnce([
          makePosting({
            createdAt: prevPostingDate,
            matches: [
              makeMatch({
                createdAt: new Date(prevPostingDate.getTime() + 5 * 24 * 60 * 60 * 1000),
              }),
            ],
          }),
        ])

      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      // Lower time = improving (for time metrics)
      expect(result.trends.timeToFirstMatch).toBe("improving")
    })

    it("computes declining trend when current is worse", async () => {
      const now = new Date()
      const currentPostingDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      const prevPostingDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)

      // Current: slow match (5 days), Previous: fast match (1 day)
      mockDb.jobPosting.findMany
        .mockResolvedValueOnce([
          makePosting({
            createdAt: currentPostingDate,
            matches: [
              makeMatch({
                createdAt: new Date(currentPostingDate.getTime() + 5 * 24 * 60 * 60 * 1000),
              }),
            ],
          }),
        ])
        .mockResolvedValueOnce([
          makePosting({
            createdAt: prevPostingDate,
            matches: [
              makeMatch({
                createdAt: new Date(prevPostingDate.getTime() + 1 * 24 * 60 * 60 * 1000),
              }),
            ],
          }),
        ])

      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      expect(result.trends.timeToFirstMatch).toBe("declining")
    })

    it("computes stable trend within 5% tolerance", async () => {
      const now = new Date()
      const currentPostingDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      const prevPostingDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)

      // Both periods have nearly identical match times (within 5%)
      const baseTime = 3 * 24 * 60 * 60 * 1000
      mockDb.jobPosting.findMany
        .mockResolvedValueOnce([
          makePosting({
            createdAt: currentPostingDate,
            matches: [
              makeMatch({
                createdAt: new Date(currentPostingDate.getTime() + baseTime),
              }),
            ],
          }),
        ])
        .mockResolvedValueOnce([
          makePosting({
            createdAt: prevPostingDate,
            matches: [
              makeMatch({
                createdAt: new Date(prevPostingDate.getTime() + baseTime * 1.03), // 3% diff
              }),
            ],
          }),
        ])

      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      expect(result.trends.timeToFirstMatch).toBe("stable")
    })

    it("returns null trend when no data for comparison", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([])
      const caller = await makeCaller()
      const result = await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      expect(result.trends.timeToFirstMatch).toBeNull()
      expect(result.trends.timeToMutualAccept).toBeNull()
      expect(result.trends.matchVolume).toBeNull()
    })

    it("scopes queries to employer org", async () => {
      mockDb.jobPosting.findMany.mockResolvedValue([])
      const caller = await makeCaller()
      await caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })

      const call = mockDb.jobPosting.findMany.mock.calls[0]![0] as {
        where: { employerId: string }
      }
      expect(call.where.employerId).toBe("emp_01")
    })

    it("throws NOT_FOUND when flag is disabled", async () => {
      mockFlagValue.value = false
      const caller = await makeCaller()

      await expect(caller.hiringMetrics.getHiringMetrics({ windowDays: 30 })).rejects.toThrow(
        "This feature is not yet available.",
      )
    })
  })

  describe("exportCsv", () => {
    it("returns CSV string with correct headers and filename", async () => {
      const postingDate = new Date("2026-01-15T00:00:00Z")
      const matchDate = new Date("2026-01-16T00:00:00Z")

      mockDb.jobPosting.findMany.mockResolvedValue([
        makePosting({
          title: "Software Engineer",
          createdAt: postingDate,
          matches: [
            makeMatch({
              createdAt: matchDate,
              mutualAcceptedAt: new Date("2026-01-20T00:00:00Z"),
              seekerStatus: "ACCEPTED",
              employerStatus: "ACCEPTED",
            }),
          ],
        }),
      ])

      const caller = await makeCaller()
      const result = await caller.hiringMetrics.exportCsv({ windowDays: 30 })

      expect(result.csv).toContain("Title,Status")
      expect(result.csv).toContain("Software Engineer")
      expect(result.filename).toMatch(/^hiring-metrics-30d-\d{4}-\d{2}-\d{2}\.csv$/)
    })

    it("throws NOT_FOUND when flag is disabled", async () => {
      mockFlagValue.value = false
      const caller = await makeCaller()

      await expect(caller.hiringMetrics.exportCsv({ windowDays: 30 })).rejects.toThrow(
        "This feature is not yet available.",
      )
    })
  })

  describe("isEnabled", () => {
    it("returns true when flag is enabled", async () => {
      const caller = await makeCaller()
      const result = await caller.hiringMetrics.isEnabled()
      expect(result).toBe(true)
    })

    it("returns false when flag is disabled", async () => {
      mockFlagValue.value = false
      const caller = await makeCaller()
      const result = await caller.hiringMetrics.isEnabled()
      expect(result).toBe(false)
    })
  })
})
