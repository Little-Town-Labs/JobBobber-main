import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockStripe, mockDb } = vi.hoisted(() => ({
  mockStripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
  mockDb: {
    employer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    jobSeeker: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/stripe", () => ({ stripe: mockStripe, getStripe: () => mockStripe }))
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/billing-plans", () => ({
  getPlanById: vi.fn((id: string) => {
    const plans: Record<string, unknown> = {
      seeker_pro: {
        id: "seeker_pro",
        stripePriceId: "price_seeker_pro_test",
        userType: "JOB_SEEKER",
      },
      employer_business: {
        id: "employer_business",
        stripePriceId: "price_employer_biz_test",
        userType: "EMPLOYER",
      },
      seeker_free: { id: "seeker_free", stripePriceId: null, userType: "JOB_SEEKER" },
    }
    return plans[id] ?? null
  }),
}))

import { createCheckoutSession, createPortalSession } from "./stripe-sessions"

describe("stripe-sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createCheckoutSession", () => {
    it("creates checkout session for seeker Pro plan", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({
        id: "seeker_1",
        clerkUserId: "user_1",
        stripeCustomerId: null,
        name: "Test Seeker",
      })
      mockDb.jobSeeker.update.mockResolvedValue({})
      mockStripe.customers.create.mockResolvedValue({ id: "cus_new" })
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/session_1",
      })

      const result = await createCheckoutSession({
        userId: "user_1",
        userType: "JOB_SEEKER",
        planId: "seeker_pro",
        db: mockDb as never,
      })

      expect(result.checkoutUrl).toBe("https://checkout.stripe.com/session_1")
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled()
    })

    it("creates checkout session for employer Business plan", async () => {
      mockDb.employer.findUnique.mockResolvedValue({
        id: "emp_1",
        clerkOrgId: "org_1",
        stripeCustomerId: "cus_existing",
      })
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/session_2",
      })

      const result = await createCheckoutSession({
        userId: "user_1",
        userType: "EMPLOYER",
        planId: "employer_business",
        orgId: "org_1",
        db: mockDb as never,
      })

      expect(result.checkoutUrl).toBe("https://checkout.stripe.com/session_2")
      expect(mockStripe.customers.create).not.toHaveBeenCalled()
    })

    it("creates Stripe customer if none exists (seeker)", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({
        id: "seeker_1",
        clerkUserId: "user_1",
        stripeCustomerId: null,
        name: "Test Seeker",
      })
      mockDb.jobSeeker.update.mockResolvedValue({})
      mockStripe.customers.create.mockResolvedValue({ id: "cus_new_seeker" })
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/session_3",
      })

      await createCheckoutSession({
        userId: "user_1",
        userType: "JOB_SEEKER",
        planId: "seeker_pro",
        db: mockDb as never,
      })

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ userId: "user_1" }),
        }),
      )
      expect(mockDb.jobSeeker.update).toHaveBeenCalledWith({
        where: { clerkUserId: "user_1" },
        data: { stripeCustomerId: "cus_new_seeker" },
      })
    })

    it("applies coupon code when provided", async () => {
      mockDb.jobSeeker.findUnique.mockResolvedValue({
        id: "seeker_1",
        clerkUserId: "user_1",
        stripeCustomerId: "cus_1",
      })
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/session_coupon",
      })

      await createCheckoutSession({
        userId: "user_1",
        userType: "JOB_SEEKER",
        planId: "seeker_pro",
        couponCode: "BETA50",
        db: mockDb as never,
      })

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discounts: [{ coupon: "BETA50" }],
        }),
      )
    })

    it("throws for invalid plan ID", async () => {
      await expect(
        createCheckoutSession({
          userId: "user_1",
          userType: "JOB_SEEKER",
          planId: "nonexistent",
          db: mockDb as never,
        }),
      ).rejects.toThrow("Invalid plan")
    })

    it("throws for free plan", async () => {
      await expect(
        createCheckoutSession({
          userId: "user_1",
          userType: "JOB_SEEKER",
          planId: "seeker_free",
          db: mockDb as never,
        }),
      ).rejects.toThrow("Cannot checkout free plan")
    })
  })

  describe("createPortalSession", () => {
    it("creates portal session for existing customer", async () => {
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://billing.stripe.com/portal_1",
      })

      const result = await createPortalSession("cus_existing")

      expect(result.portalUrl).toBe("https://billing.stripe.com/portal_1")
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing",
        }),
      )
    })

    it("throws when no customer ID provided", async () => {
      await expect(createPortalSession("")).rejects.toThrow("Stripe customer ID required")
    })
  })
})
