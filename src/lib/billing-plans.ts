import "server-only"
import { env } from "@/lib/env"

/**
 * Subscription plan definitions for JobBobber.
 *
 * Plans are application constants (not DB records) since they map directly
 * to Stripe Price IDs and rarely change. See data-model.md for rationale.
 */

export interface PlanLimits {
  /** Max agent conversations per calendar month. null = unlimited. */
  maxConversationsPerMonth: number | null
  /** Max active job postings (employer only). null = unlimited. */
  maxActivePostings: number | null
}

export interface BillingPlan {
  id: string
  name: string
  userType: "JOB_SEEKER" | "EMPLOYER"
  monthlyPrice: number
  features: string[]
  limits: PlanLimits
  stripePriceId: string | null
  isEnterprise: boolean
}

const PLANS: readonly BillingPlan[] = [
  {
    id: "seeker_free",
    name: "Free",
    userType: "JOB_SEEKER",
    monthlyPrice: 0,
    features: ["Up to 5 agent conversations per month", "Basic profile", "AI-powered matching"],
    limits: {
      maxConversationsPerMonth: 5,
      maxActivePostings: null,
    },
    stripePriceId: null,
    isEnterprise: false,
  },
  {
    id: "seeker_pro",
    name: "Pro",
    userType: "JOB_SEEKER",
    monthlyPrice: 39,
    features: [
      "Unlimited agent conversations",
      "Priority matching",
      "Advanced profile features",
      "Custom agent prompts",
    ],
    limits: {
      maxConversationsPerMonth: null,
      maxActivePostings: null,
    },
    stripePriceId: env.STRIPE_PRICE_SEEKER_PRO ?? null,
    isEnterprise: false,
  },
  {
    id: "employer_free",
    name: "Free",
    userType: "EMPLOYER",
    monthlyPrice: 0,
    features: [
      "1 active job posting",
      "Up to 10 agent conversations per month",
      "Basic candidate matching",
    ],
    limits: {
      maxConversationsPerMonth: 10,
      maxActivePostings: 1,
    },
    stripePriceId: null,
    isEnterprise: false,
  },
  {
    id: "employer_business",
    name: "Business",
    userType: "EMPLOYER",
    monthlyPrice: 99,
    features: [
      "Unlimited active postings",
      "Unlimited agent conversations",
      "Advanced candidate matching",
      "Team collaboration",
      "Custom agent prompts",
    ],
    limits: {
      maxConversationsPerMonth: null,
      maxActivePostings: null,
    },
    stripePriceId: env.STRIPE_PRICE_EMPLOYER_BUSINESS ?? null,
    isEnterprise: false,
  },
  {
    id: "employer_enterprise",
    name: "Enterprise",
    userType: "EMPLOYER",
    monthlyPrice: 0,
    features: [
      "Everything in Business",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantees",
      "Volume pricing",
    ],
    limits: {
      maxConversationsPerMonth: null,
      maxActivePostings: null,
    },
    stripePriceId: null,
    isEnterprise: true,
  },
] as const

export function getPlanById(id: string): BillingPlan | undefined {
  return PLANS.find((p) => p.id === id)
}

export function getPlansForUserType(userType: "JOB_SEEKER" | "EMPLOYER"): BillingPlan[] {
  return PLANS.filter((p) => p.userType === userType)
}

export function getFreePlan(userType: "JOB_SEEKER" | "EMPLOYER"): BillingPlan {
  const freePlanId = userType === "JOB_SEEKER" ? "seeker_free" : "employer_free"
  return PLANS.find((p) => p.id === freePlanId)!
}

/**
 * Get the current plan for a user based on their subscription's planId.
 * Returns the free plan if no subscription or if the planId is unknown.
 */
export function getPlanForUser(
  userType: "JOB_SEEKER" | "EMPLOYER",
  planId: string | null,
): BillingPlan {
  if (!planId) {
    return getFreePlan(userType)
  }
  return getPlanById(planId) ?? getFreePlan(userType)
}
