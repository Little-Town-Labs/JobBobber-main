/**
 * Static copies of billing plan data for the public marketing page.
 * Mirrors the values in src/lib/billing-plans.ts but avoids the server-only
 * import chain (which pulls in env validation) on the public landing page.
 *
 * Keep in sync with billing-plans.ts when plan details change.
 */

export interface MarketingPlan {
  id: string
  name: string
  userType: "JOB_SEEKER" | "EMPLOYER"
  monthlyPrice: number
  features: readonly string[]
  isEnterprise: boolean
}

export const SEEKER_PLANS: readonly MarketingPlan[] = [
  {
    id: "seeker_free",
    name: "Free",
    userType: "JOB_SEEKER",
    monthlyPrice: 0,
    features: ["Up to 5 agent conversations per month", "Basic profile", "AI-powered matching"],
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
    isEnterprise: false,
  },
]

export const EMPLOYER_PLANS: readonly MarketingPlan[] = [
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
    isEnterprise: true,
  },
]
