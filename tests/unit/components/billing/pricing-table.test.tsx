// @vitest-environment happy-dom
/**
 * Task 4.1 — Pricing table component tests (TDD RED phase).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const { mockGetPlans, mockGetSubscription, mockCreateCheckoutMutate, mockInvalidate } = vi.hoisted(
  () => ({
    mockGetPlans: vi.fn(),
    mockGetSubscription: vi.fn(),
    mockCreateCheckoutMutate: vi.fn(),
    mockInvalidate: vi.fn(),
  }),
)

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      billing: {
        getSubscription: { invalidate: mockInvalidate },
      },
    }),
    billing: {
      getPlans: { useQuery: (...args: unknown[]) => mockGetPlans(...args) },
      getSubscription: { useQuery: (...args: unknown[]) => mockGetSubscription(...args) },
      createCheckoutSession: {
        useMutation: () => ({
          mutate: mockCreateCheckoutMutate,
          mutateAsync: mockCreateCheckoutMutate,
          isPending: false,
        }),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { PricingTable } from "@/components/billing/pricing-table"

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const seekerPlans = [
  {
    id: "seeker_free",
    name: "Free",
    userType: "JOB_SEEKER",
    monthlyPrice: 0,
    features: ["Up to 5 agent conversations per month", "Basic profile", "AI-powered matching"],
    limits: { maxConversationsPerMonth: 5, maxActivePostings: null },
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
    limits: { maxConversationsPerMonth: null, maxActivePostings: null },
    stripePriceId: "price_seeker_pro",
    isEnterprise: false,
  },
]

const employerPlans = [
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
    limits: { maxConversationsPerMonth: 10, maxActivePostings: 1 },
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
    limits: { maxConversationsPerMonth: null, maxActivePostings: null },
    stripePriceId: "price_employer_business",
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
    limits: { maxConversationsPerMonth: null, maxActivePostings: null },
    stripePriceId: null,
    isEnterprise: true,
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PricingTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("loading state", () => {
    it("shows loading skeleton while plans load", () => {
      mockGetPlans.mockReturnValue({ data: undefined, isLoading: true })
      mockGetSubscription.mockReturnValue({ data: undefined, isLoading: true })

      render(<PricingTable userType="JOB_SEEKER" />)
      expect(screen.getByTestId("pricing-loading")).toBeTruthy()
    })
  })

  describe("plan card rendering", () => {
    it("renders seeker plan cards with name and price", () => {
      mockGetPlans.mockReturnValue({ data: seekerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="JOB_SEEKER" />)

      expect(screen.getByText("Free")).toBeTruthy()
      expect(screen.getByText("Pro")).toBeTruthy()
      expect(screen.getByText("$0")).toBeTruthy()
      expect(screen.getByText("$39")).toBeTruthy()
    })

    it("renders plan features", () => {
      mockGetPlans.mockReturnValue({ data: seekerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="JOB_SEEKER" />)

      expect(screen.getByText("Up to 5 agent conversations per month")).toBeTruthy()
      expect(screen.getByText("Unlimited agent conversations")).toBeTruthy()
    })

    it("renders employer plans including Enterprise", () => {
      mockGetPlans.mockReturnValue({ data: employerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="EMPLOYER" />)

      expect(screen.getByText("Free")).toBeTruthy()
      expect(screen.getByText("Business")).toBeTruthy()
      expect(screen.getByText("Enterprise")).toBeTruthy()
    })
  })

  describe("current plan highlighting", () => {
    it("highlights the current plan for subscribed user", () => {
      mockGetPlans.mockReturnValue({ data: seekerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({
        data: { planId: "seeker_pro", status: "ACTIVE" },
        isLoading: false,
      })

      render(<PricingTable userType="JOB_SEEKER" />)

      const badges = screen.getAllByText("Current Plan")
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })

    it("highlights free plan when no subscription", () => {
      mockGetPlans.mockReturnValue({ data: seekerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="JOB_SEEKER" />)

      const badges = screen.getAllByText("Current Plan")
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("upgrade CTA", () => {
    it("shows upgrade button for non-current paid plans", () => {
      mockGetPlans.mockReturnValue({ data: seekerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="JOB_SEEKER" />)

      const upgradeButton = screen.getByRole("button", { name: /upgrade/i })
      expect(upgradeButton).toBeTruthy()
    })

    it("calls createCheckoutSession on upgrade click", async () => {
      mockGetPlans.mockReturnValue({ data: seekerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="JOB_SEEKER" />)

      const user = userEvent.setup()
      const upgradeButton = screen.getByRole("button", { name: /upgrade/i })
      await user.click(upgradeButton)

      expect(mockCreateCheckoutMutate).toHaveBeenCalledWith(
        expect.objectContaining({ planId: "seeker_pro" }),
        expect.anything(),
      )
    })
  })

  describe("Enterprise tier", () => {
    it("shows Contact Sales for enterprise plan", () => {
      mockGetPlans.mockReturnValue({ data: employerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="EMPLOYER" />)

      expect(screen.getByText(/contact sales/i)).toBeTruthy()
    })

    it("does not show price for enterprise plan", () => {
      mockGetPlans.mockReturnValue({ data: employerPlans, isLoading: false })
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })

      render(<PricingTable userType="EMPLOYER" />)

      expect(screen.getByText("Custom")).toBeTruthy()
    })
  })
})
