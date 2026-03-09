import { describe, it, expect, vi, beforeEach } from "vitest"

let billingEnabled = true

const { mockDb, mockCreateCheckout, mockCreatePortal, mockStripe } = vi.hoisted(() => ({
  mockDb: {
    subscription: { findFirst: vi.fn() },
    agentConversation: { count: vi.fn() },
    jobPosting: { count: vi.fn() },
    jobSeeker: { findUnique: vi.fn(), update: vi.fn() },
    employer: { findUnique: vi.fn(), update: vi.fn() },
  },
  mockCreateCheckout: vi.fn(),
  mockCreatePortal: vi.fn(),
  mockStripe: {
    invoices: { list: vi.fn() },
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/stripe", () => ({ stripe: mockStripe }))
vi.mock("@/lib/stripe-sessions", () => ({
  createCheckoutSession: mockCreateCheckout,
  createPortalSession: mockCreatePortal,
}))
vi.mock("@/lib/flags", () => ({
  SUBSCRIPTION_BILLING: () => billingEnabled,
  assertFlagEnabled: async (flagFn: () => boolean | Promise<boolean>) => {
    const enabled = await flagFn()
    if (!enabled) {
      const { TRPCError } = await import("@trpc/server")
      throw new TRPCError({ code: "NOT_FOUND", message: "Feature not available" })
    }
  },
}))

// Need to mock clerk auth for tRPC context
vi.mock("@clerk/nextjs/server", () => ({
  auth: () =>
    Promise.resolve({
      userId: "user_1",
      orgId: null,
      orgRole: null,
      sessionClaims: { metadata: { role: "JOB_SEEKER" } },
    }),
}))

import { appRouter } from "@/server/api/root"
import { createCallerFactory } from "@/server/api/trpc"

function makeCaller(overrides?: {
  userRole?: "JOB_SEEKER" | "EMPLOYER"
  orgId?: string
  orgRole?: "org:admin" | "org:member"
}) {
  return createCallerFactory(appRouter)({
    db: mockDb as never,
    inngest: null as never,
    userId: "user_1",
    orgId: overrides?.orgId ?? null,
    orgRole: overrides?.orgRole ?? null,
    userRole: overrides?.userRole ?? "JOB_SEEKER",
  })
}

describe("billing router", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    billingEnabled = true
  })

  describe("getPlans", () => {
    it("returns seeker plans", async () => {
      const caller = makeCaller()
      const plans = await caller.billing.getPlans({ userType: "JOB_SEEKER" })

      expect(plans).toHaveLength(2)
      expect(plans[0]!.id).toBe("seeker_free")
      expect(plans[1]!.id).toBe("seeker_pro")
    })

    it("returns employer plans", async () => {
      const caller = makeCaller({ userRole: "EMPLOYER", orgId: "org_1", orgRole: "org:admin" })
      const plans = await caller.billing.getPlans({ userType: "EMPLOYER" })

      expect(plans).toHaveLength(3)
      expect(plans.map((p: { id: string }) => p.id)).toEqual([
        "employer_free",
        "employer_business",
        "employer_enterprise",
      ])
    })

    it("returns NOT_FOUND when flag is OFF", async () => {
      billingEnabled = false
      const caller = makeCaller()

      await expect(caller.billing.getPlans({ userType: "JOB_SEEKER" })).rejects.toThrow()
    })
  })

  describe("getSubscription", () => {
    it("returns active subscription", async () => {
      mockDb.subscription.findFirst.mockResolvedValue({
        id: "sub_internal",
        planId: "seeker_pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-04-01"),
        cancelAtPeriodEnd: false,
      })

      const caller = makeCaller()
      const sub = await caller.billing.getSubscription()

      expect(sub).not.toBeNull()
      expect(sub!.planId).toBe("seeker_pro")
      expect(sub!.status).toBe("ACTIVE")
    })

    it("returns null when no subscription", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)

      const caller = makeCaller()
      const sub = await caller.billing.getSubscription()

      expect(sub).toBeNull()
    })
  })

  describe("getUsage", () => {
    it("returns seeker usage", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(3)

      const caller = makeCaller()
      const usage = await caller.billing.getUsage()

      expect(usage.conversationsThisMonth).toBe(3)
      expect(usage.conversationLimit).toBe(5)
    })

    it("returns employer usage", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(7)
      mockDb.jobPosting.count.mockResolvedValue(1)

      const caller = makeCaller({ userRole: "EMPLOYER", orgId: "org_1", orgRole: "org:admin" })
      const usage = await caller.billing.getUsage()

      expect(usage.conversationsThisMonth).toBe(7)
      expect(usage.activePostings).toBe(1)
    })
  })

  describe("getPaymentHistory", () => {
    it("returns invoices from Stripe", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      // For seekers, look up stripeCustomerId
      mockDb.jobSeeker.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" })
      mockStripe.invoices.list.mockResolvedValue({
        data: [
          {
            id: "inv_1",
            created: Math.floor(Date.now() / 1000),
            amount_paid: 3900,
            status: "paid",
            hosted_invoice_url: "https://invoice.stripe.com/inv_1",
          },
        ],
      })

      const caller = makeCaller()
      const history = await caller.billing.getPaymentHistory()

      expect(history).toHaveLength(1)
      expect(history[0]!.amount).toBe(39)
      expect(history[0]!.status).toBe("paid")
    })

    it("returns empty array when no Stripe customer", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({ stripeCustomerId: null })

      const caller = makeCaller()
      const history = await caller.billing.getPaymentHistory()

      expect(history).toEqual([])
    })
  })

  describe("createCheckoutSession", () => {
    it("creates checkout session for valid plan", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({
        id: "seeker_1",
        clerkUserId: "user_1",
        stripeCustomerId: "cus_1",
      })
      mockCreateCheckout.mockResolvedValue({
        checkoutUrl: "https://checkout.stripe.com/session_1",
      })

      const caller = makeCaller()
      const result = await caller.billing.createCheckoutSession({ planId: "seeker_pro" })

      expect(result.checkoutUrl).toBe("https://checkout.stripe.com/session_1")
    })

    it("passes coupon code when provided", async () => {
      mockCreateCheckout.mockResolvedValue({
        checkoutUrl: "https://checkout.stripe.com/coupon",
      })

      const caller = makeCaller()
      await caller.billing.createCheckoutSession({
        planId: "seeker_pro",
        couponCode: "BETA50",
      })

      expect(mockCreateCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ couponCode: "BETA50" }),
      )
    })
  })

  describe("createPortalSession", () => {
    it("creates portal session for seeker with stripe customer", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" })
      mockCreatePortal.mockResolvedValue({
        portalUrl: "https://billing.stripe.com/portal_1",
      })

      const caller = makeCaller()
      const result = await caller.billing.createPortalSession()

      expect(result.portalUrl).toBe("https://billing.stripe.com/portal_1")
    })

    it("throws when no Stripe customer", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({ stripeCustomerId: null })

      const caller = makeCaller()
      await expect(caller.billing.createPortalSession()).rejects.toThrow()
    })
  })

  describe("checkLimit", () => {
    it("checks conversation limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.agentConversation.count.mockResolvedValue(3)

      const caller = makeCaller()
      const result = await caller.billing.checkLimit({ action: "create_conversation" })

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(5)
    })

    it("checks posting limit", async () => {
      mockDb.subscription.findFirst.mockResolvedValue(null)
      mockDb.jobPosting.count.mockResolvedValue(0)

      const caller = makeCaller({ userRole: "EMPLOYER", orgId: "org_1", orgRole: "org:admin" })
      const result = await caller.billing.checkLimit({ action: "create_posting" })

      expect(result.allowed).toBe(true)
    })
  })

  describe("feature flag gating", () => {
    it("all procedures return NOT_FOUND when flag OFF", async () => {
      billingEnabled = false
      const caller = makeCaller()

      await expect(caller.billing.getPlans({ userType: "JOB_SEEKER" })).rejects.toThrow()
      await expect(caller.billing.getSubscription()).rejects.toThrow()
      await expect(caller.billing.getUsage()).rejects.toThrow()
      await expect(caller.billing.getPaymentHistory()).rejects.toThrow()
      await expect(caller.billing.checkLimit({ action: "create_conversation" })).rejects.toThrow()
    })
  })
})
