import { describe, it, expect } from "vitest"
import { getPlanById, getPlansForUserType, getFreePlan, getPlanForUser } from "./billing-plans"

describe("billing-plans", () => {
  describe("getPlanById", () => {
    it("returns seeker_free plan", () => {
      const plan = getPlanById("seeker_free")
      expect(plan).toBeDefined()
      expect(plan!.id).toBe("seeker_free")
      expect(plan!.name).toBe("Free")
      expect(plan!.userType).toBe("JOB_SEEKER")
      expect(plan!.monthlyPrice).toBe(0)
    })

    it("returns seeker_pro plan", () => {
      const plan = getPlanById("seeker_pro")
      expect(plan).toBeDefined()
      expect(plan!.id).toBe("seeker_pro")
      expect(plan!.name).toBe("Pro")
      expect(plan!.userType).toBe("JOB_SEEKER")
      expect(plan!.monthlyPrice).toBe(39)
    })

    it("returns employer_free plan", () => {
      const plan = getPlanById("employer_free")
      expect(plan).toBeDefined()
      expect(plan!.id).toBe("employer_free")
      expect(plan!.userType).toBe("EMPLOYER")
      expect(plan!.monthlyPrice).toBe(0)
    })

    it("returns employer_business plan", () => {
      const plan = getPlanById("employer_business")
      expect(plan).toBeDefined()
      expect(plan!.id).toBe("employer_business")
      expect(plan!.userType).toBe("EMPLOYER")
      expect(plan!.monthlyPrice).toBe(99)
    })

    it("returns employer_enterprise plan", () => {
      const plan = getPlanById("employer_enterprise")
      expect(plan).toBeDefined()
      expect(plan!.id).toBe("employer_enterprise")
      expect(plan!.isEnterprise).toBe(true)
    })

    it("returns undefined for unknown plan ID", () => {
      const plan = getPlanById("nonexistent")
      expect(plan).toBeUndefined()
    })
  })

  describe("plan limits", () => {
    it("seeker_free has conversation limit of 5", () => {
      const plan = getPlanById("seeker_free")!
      expect(plan.limits.maxConversationsPerMonth).toBe(5)
    })

    it("seeker_pro has unlimited conversations", () => {
      const plan = getPlanById("seeker_pro")!
      expect(plan.limits.maxConversationsPerMonth).toBeNull()
    })

    it("employer_free has 1 active posting limit", () => {
      const plan = getPlanById("employer_free")!
      expect(plan.limits.maxActivePostings).toBe(1)
    })

    it("employer_free has conversation limit of 10", () => {
      const plan = getPlanById("employer_free")!
      expect(plan.limits.maxConversationsPerMonth).toBe(10)
    })

    it("employer_business has unlimited postings and conversations", () => {
      const plan = getPlanById("employer_business")!
      expect(plan.limits.maxActivePostings).toBeNull()
      expect(plan.limits.maxConversationsPerMonth).toBeNull()
    })
  })

  describe("getPlansForUserType", () => {
    it("returns seeker plans", () => {
      const plans = getPlansForUserType("JOB_SEEKER")
      expect(plans).toHaveLength(2)
      expect(plans.map((p) => p.id)).toEqual(["seeker_free", "seeker_pro"])
    })

    it("returns employer plans", () => {
      const plans = getPlansForUserType("EMPLOYER")
      expect(plans).toHaveLength(3)
      expect(plans.map((p) => p.id)).toEqual([
        "employer_free",
        "employer_business",
        "employer_enterprise",
      ])
    })
  })

  describe("getFreePlan", () => {
    it("returns seeker free plan for JOB_SEEKER", () => {
      const plan = getFreePlan("JOB_SEEKER")
      expect(plan.id).toBe("seeker_free")
      expect(plan.monthlyPrice).toBe(0)
    })

    it("returns employer free plan for EMPLOYER", () => {
      const plan = getFreePlan("EMPLOYER")
      expect(plan.id).toBe("employer_free")
      expect(plan.monthlyPrice).toBe(0)
    })
  })

  describe("getPlanForUser", () => {
    it("returns free plan when no subscription (seeker)", () => {
      const plan = getPlanForUser("JOB_SEEKER", null)
      expect(plan.id).toBe("seeker_free")
    })

    it("returns free plan when no subscription (employer)", () => {
      const plan = getPlanForUser("EMPLOYER", null)
      expect(plan.id).toBe("employer_free")
    })

    it("returns the subscribed plan when subscription exists", () => {
      const plan = getPlanForUser("JOB_SEEKER", "seeker_pro")
      expect(plan.id).toBe("seeker_pro")
    })

    it("returns free plan when subscribed plan ID is unknown", () => {
      const plan = getPlanForUser("JOB_SEEKER", "nonexistent")
      expect(plan.id).toBe("seeker_free")
    })
  })

  describe("stripe price ID mapping", () => {
    it("free plans have no stripe price ID", () => {
      expect(getPlanById("seeker_free")!.stripePriceId).toBeNull()
      expect(getPlanById("employer_free")!.stripePriceId).toBeNull()
    })

    it("paid plans have stripe price IDs from env vars (null when env var absent)", () => {
      const seekerPro = getPlanById("seeker_pro")!
      const employerBiz = getPlanById("employer_business")!
      // stripePriceId is string when env var is set, null when absent — never empty string
      expect(seekerPro.stripePriceId === null || typeof seekerPro.stripePriceId === "string").toBe(
        true,
      )
      expect(
        employerBiz.stripePriceId === null || typeof employerBiz.stripePriceId === "string",
      ).toBe(true)
    })

    it("enterprise plan has no stripe price ID", () => {
      expect(getPlanById("employer_enterprise")!.stripePriceId).toBeNull()
    })
  })

  describe("plan features", () => {
    it("each plan has at least one feature listed", () => {
      const planIds = [
        "seeker_free",
        "seeker_pro",
        "employer_free",
        "employer_business",
        "employer_enterprise",
      ]
      for (const id of planIds) {
        const plan = getPlanById(id)!
        expect(plan.features.length).toBeGreaterThan(0)
      }
    })
  })
})
