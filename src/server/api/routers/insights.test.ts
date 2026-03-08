/**
 * Task 4.1 — Insights Router Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockDb = vi.hoisted(() => ({
  feedbackInsights: {
    findUnique: vi.fn(),
  },
  agentConversation: {
    count: vi.fn(),
  },
  jobSeeker: {
    findUnique: vi.fn(),
  },
  employer: {
    findUnique: vi.fn(),
  },
  employerMember: {
    findUnique: vi.fn(),
  },
  jobPosting: {
    findUnique: vi.fn(),
  },
}))

const mockInngest = vi.hoisted(() => ({
  send: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: mockInngest }))
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
}))

// Mock the feature flag to be enabled
vi.mock("@/lib/flags", () => ({
  FEEDBACK_INSIGHTS: vi.fn().mockResolvedValue(true),
  assertFlagEnabled: vi.fn().mockResolvedValue(undefined),
}))

async function makeSeekerCaller(seekerId: string) {
  mockDb.jobSeeker.findUnique.mockResolvedValue({ id: seekerId, clerkUserId: "user-1" })

  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { insightsRouter } = await import("@/server/api/routers/insights")

  return createCallerFactory(createTRPCRouter({ insights: insightsRouter }))({
    db: mockDb as never,
    inngest: mockInngest as never,
    userId: "user-1",
    orgId: null,
    orgRole: null,
    userRole: "JOB_SEEKER",
  } as never)
}

async function makeEmployerCaller(employerId: string, orgId: string) {
  mockDb.employer.findUnique.mockResolvedValue({ id: employerId, clerkOrgId: orgId })
  mockDb.employerMember.findUnique.mockResolvedValue({
    id: "member-1",
    employerId,
    clerkUserId: "user-1",
    role: "ADMIN",
  })

  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { insightsRouter } = await import("@/server/api/routers/insights")

  return createCallerFactory(createTRPCRouter({ insights: insightsRouter }))({
    db: mockDb as never,
    inngest: mockInngest as never,
    userId: "user-1",
    orgId,
    orgRole: "org:admin",
    userRole: "EMPLOYER",
  } as never)
}

describe("insights router", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("getSeekerInsights", () => {
    it("returns insights when they exist", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue({
        id: "insight-1",
        strengths: ["Good skills"],
        weaknesses: ["Needs experience"],
        recommendations: ["Build portfolio"],
        totalConversations: 10,
        inProgressCount: 0,
        matchRate: 0.4,
        interviewConversionRate: 0.5,
        trendDirection: "IMPROVING",
        generatedAt: new Date("2026-03-01"),
      })
      mockDb.agentConversation.count.mockResolvedValue(10)

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.insights.getSeekerInsights()

      expect(result).not.toBeNull()
      expect(result!.strengths).toEqual(["Good skills"])
      expect(result!.belowThreshold).toBe(false)
    })

    it("returns threshold progress when below minimum", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(1)

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.insights.getSeekerInsights()

      expect(result).not.toBeNull()
      expect(result!.belowThreshold).toBe(true)
      expect(result!.thresholdProgress).toEqual({ current: 1, required: 3 })
    })

    it("returns null insights with threshold when zero conversations", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(0)

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.insights.getSeekerInsights()

      expect(result!.belowThreshold).toBe(true)
      expect(result!.thresholdProgress).toEqual({ current: 0, required: 3 })
    })
  })

  describe("getEmployerInsights", () => {
    it("returns employer insights", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue({
        id: "insight-1",
        strengths: ["Clear descriptions"],
        weaknesses: ["Limited benefits"],
        recommendations: ["Improve comp package"],
        totalConversations: 8,
        inProgressCount: 2,
        matchRate: 0.5,
        interviewConversionRate: 0.6,
        trendDirection: "STABLE",
        generatedAt: new Date("2026-03-01"),
      })
      mockDb.agentConversation.count.mockResolvedValue(8)

      const caller = await makeEmployerCaller("emp-1", "org-1")
      const result = await caller.insights.getEmployerInsights()

      expect(result).not.toBeNull()
      expect(result!.strengths).toEqual(["Clear descriptions"])
    })

    it("returns threshold progress when below minimum", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(2)

      const caller = await makeEmployerCaller("emp-1", "org-1")
      const result = await caller.insights.getEmployerInsights()

      expect(result!.belowThreshold).toBe(true)
    })
  })

  describe("refreshInsights", () => {
    it("sends Inngest event for seeker", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue({
        generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      })

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.insights.refreshInsights()

      expect(result.status).toBe("queued")
      expect(mockInngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "insights/generate",
        }),
      )
    })

    it("rate limits when last refresh was less than 1 hour ago", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue({
        generatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
      })

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.insights.refreshInsights()

      expect(result.status).toBe("rate_limited")
      expect(mockInngest.send).not.toHaveBeenCalled()
    })

    it("allows refresh when no existing insights", async () => {
      mockDb.feedbackInsights.findUnique.mockResolvedValue(null)

      const caller = await makeSeekerCaller("seeker-1")
      const result = await caller.insights.refreshInsights()

      expect(result.status).toBe("queued")
    })
  })
})
