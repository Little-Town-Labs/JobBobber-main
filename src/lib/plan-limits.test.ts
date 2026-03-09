import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockDb, mockFlags } = vi.hoisted(() => ({
  mockDb: {
    agentConversation: { count: vi.fn() },
    jobPosting: { count: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
  mockFlags: { billingEnabled: true },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/flags", () => ({
  SUBSCRIPTION_BILLING: () => mockFlags.billingEnabled,
  assertFlagEnabled: vi.fn(),
}))

import { checkConversationLimit, checkPostingLimit } from "./plan-limits"

describe("plan-limits", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFlags.billingEnabled = true
  })

  describe("checkConversationLimit", () => {
    it("allows when under free seeker limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(3)

      const result = await checkConversationLimit(mockDb as never, "user_1", "JOB_SEEKER")

      expect(result.allowed).toBe(true)
      expect(result.currentUsage).toBe(3)
      expect(result.limit).toBe(5)
    })

    it("denies when at free seeker limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(5)

      const result = await checkConversationLimit(mockDb as never, "user_1", "JOB_SEEKER")

      expect(result.allowed).toBe(false)
      expect(result.currentUsage).toBe(5)
      expect(result.limit).toBe(5)
      expect(result.upgradeRequired).toBe(true)
      expect(result.message).toBeTruthy()
    })

    it("allows unlimited for pro seeker", async () => {
      mockDb.subscription.findFirst.mockResolvedValue({
        planId: "seeker_pro",
        status: "ACTIVE",
      })
      mockDb.agentConversation.count.mockResolvedValue(100)

      const result = await checkConversationLimit(mockDb as never, "user_1", "JOB_SEEKER")

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
    })

    it("allows when under free employer limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(7)

      const result = await checkConversationLimit(mockDb as never, "user_1", "EMPLOYER")

      expect(result.allowed).toBe(true)
      expect(result.currentUsage).toBe(7)
      expect(result.limit).toBe(10)
    })

    it("denies when at free employer limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(10)

      const result = await checkConversationLimit(mockDb as never, "user_1", "EMPLOYER")

      expect(result.allowed).toBe(false)
      expect(result.upgradeRequired).toBe(true)
    })

    it("allows unlimited for business employer", async () => {
      mockDb.subscription.findFirst.mockResolvedValue({
        planId: "employer_business",
        status: "ACTIVE",
      })
      mockDb.agentConversation.count.mockResolvedValue(500)

      const result = await checkConversationLimit(mockDb as never, "user_1", "EMPLOYER")

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
    })

    it("defaults to free tier when no subscription", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(0)

      const result = await checkConversationLimit(mockDb as never, "user_1", "JOB_SEEKER")

      expect(result.limit).toBe(5)
    })

    it("bypasses limits when SUBSCRIPTION_BILLING flag is OFF", async () => {
      mockFlags.billingEnabled = false
      mockDb.agentConversation.count.mockResolvedValue(100)

      const result = await checkConversationLimit(mockDb as never, "user_1", "JOB_SEEKER")

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
    })
  })

  describe("checkPostingLimit", () => {
    it("allows when under free employer posting limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.jobPosting.count.mockResolvedValue(0)

      const result = await checkPostingLimit(mockDb as never, "user_1")

      expect(result.allowed).toBe(true)
      expect(result.currentUsage).toBe(0)
      expect(result.limit).toBe(1)
    })

    it("denies when at free employer posting limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.jobPosting.count.mockResolvedValue(1)

      const result = await checkPostingLimit(mockDb as never, "user_1")

      expect(result.allowed).toBe(false)
      expect(result.upgradeRequired).toBe(true)
    })

    it("allows unlimited postings for business employer", async () => {
      mockDb.subscription.findFirst.mockResolvedValue({
        planId: "employer_business",
        status: "ACTIVE",
      })
      mockDb.jobPosting.count.mockResolvedValue(50)

      const result = await checkPostingLimit(mockDb as never, "user_1")

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
    })

    it("bypasses limits when SUBSCRIPTION_BILLING flag is OFF", async () => {
      mockFlags.billingEnabled = false
      mockDb.jobPosting.count.mockResolvedValue(100)

      const result = await checkPostingLimit(mockDb as never, "user_1")

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
    })
  })

  describe("LimitCheck response shape", () => {
    it("returns correct shape when allowed", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(2)

      const result = await checkConversationLimit(mockDb as never, "user_1", "JOB_SEEKER")

      expect(result).toEqual({
        allowed: true,
        currentUsage: 2,
        limit: 5,
        upgradeRequired: false,
        message: null,
      })
    })

    it("returns correct shape when denied", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(5)

      const result = await checkConversationLimit(mockDb as never, "user_1", "JOB_SEEKER")

      expect(result).toHaveProperty("allowed", false)
      expect(result).toHaveProperty("currentUsage", 5)
      expect(result).toHaveProperty("limit", 5)
      expect(result).toHaveProperty("upgradeRequired", true)
      expect(result).toHaveProperty("message")
      expect(typeof result.message).toBe("string")
    })
  })
})
