// @vitest-environment happy-dom
/**
 * Task 4.3 — Billing dashboard component tests (TDD RED phase).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const {
  mockGetSubscription,
  mockGetUsage,
  mockGetPaymentHistory,
  mockCreateCheckoutMutate,
  mockCreatePortalMutate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockGetSubscription: vi.fn(),
  mockGetUsage: vi.fn(),
  mockGetPaymentHistory: vi.fn(),
  mockCreateCheckoutMutate: vi.fn(),
  mockCreatePortalMutate: vi.fn(),
  mockInvalidate: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      billing: {
        getSubscription: { invalidate: mockInvalidate },
        getUsage: { invalidate: mockInvalidate },
        getPaymentHistory: { invalidate: mockInvalidate },
      },
    }),
    billing: {
      getSubscription: { useQuery: (...args: unknown[]) => mockGetSubscription(...args) },
      getUsage: { useQuery: (...args: unknown[]) => mockGetUsage(...args) },
      getPaymentHistory: { useQuery: (...args: unknown[]) => mockGetPaymentHistory(...args) },
      createCheckoutSession: {
        useMutation: () => ({
          mutate: mockCreateCheckoutMutate,
          mutateAsync: mockCreateCheckoutMutate,
          isPending: false,
        }),
      },
      createPortalSession: {
        useMutation: () => ({
          mutate: mockCreatePortalMutate,
          mutateAsync: mockCreatePortalMutate,
          isPending: false,
        }),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { BillingDashboard } from "@/components/billing/billing-dashboard"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BillingDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("loading state", () => {
    it("shows loading skeleton while data loads", () => {
      mockGetSubscription.mockReturnValue({ data: undefined, isLoading: true })
      mockGetUsage.mockReturnValue({ data: undefined, isLoading: true })
      mockGetPaymentHistory.mockReturnValue({ data: undefined, isLoading: true })

      render(<BillingDashboard userType="JOB_SEEKER" />)
      expect(screen.getByTestId("billing-loading")).toBeTruthy()
    })
  })

  describe("current plan display", () => {
    it("shows current plan name and price for subscribed user", () => {
      mockGetSubscription.mockReturnValue({
        data: {
          planId: "seeker_pro",
          planName: "Pro",
          status: "ACTIVE",
          monthlyPrice: 39,
          currentPeriodEnd: "2026-04-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
        isLoading: false,
      })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 12,
          conversationLimit: null,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByText("Pro")).toBeTruthy()
      expect(screen.getByText("$39/mo")).toBeTruthy()
    })

    it("shows renewal date", () => {
      mockGetSubscription.mockReturnValue({
        data: {
          planId: "seeker_pro",
          planName: "Pro",
          status: "ACTIVE",
          monthlyPrice: 39,
          currentPeriodEnd: "2026-04-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
        isLoading: false,
      })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 12,
          conversationLimit: null,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByText(/renews/i)).toBeTruthy()
    })

    it("shows Free plan when no subscription", () => {
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 3,
          conversationLimit: 5,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByText("Free")).toBeTruthy()
    })
  })

  describe("usage meters", () => {
    it("shows conversation usage for seeker", () => {
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 3,
          conversationLimit: 5,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByText("3 / 5")).toBeTruthy()
      expect(screen.getByText(/conversations/i)).toBeTruthy()
    })

    it("shows posting and conversation usage for employer", () => {
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 7,
          conversationLimit: 10,
          activePostings: 1,
          postingLimit: 1,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="EMPLOYER" />)

      expect(screen.getByText("7 / 10")).toBeTruthy()
      expect(screen.getByText("1 / 1")).toBeTruthy()
    })

    it("shows unlimited for null limits", () => {
      mockGetSubscription.mockReturnValue({
        data: {
          planId: "seeker_pro",
          planName: "Pro",
          status: "ACTIVE",
          monthlyPrice: 39,
          currentPeriodEnd: "2026-04-01",
          cancelAtPeriodEnd: false,
        },
        isLoading: false,
      })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 12,
          conversationLimit: null,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByText(/unlimited/i)).toBeTruthy()
    })
  })

  describe("payment history", () => {
    it("shows payment history table with invoices", () => {
      mockGetSubscription.mockReturnValue({
        data: {
          planId: "seeker_pro",
          planName: "Pro",
          status: "ACTIVE",
          monthlyPrice: 39,
          currentPeriodEnd: "2026-04-01",
          cancelAtPeriodEnd: false,
        },
        isLoading: false,
      })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 12,
          conversationLimit: null,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({
        data: [
          {
            id: "inv_1",
            date: "2026-03-01T00:00:00.000Z",
            amount: 39,
            status: "paid",
            invoiceUrl: "https://example.com/inv_1",
          },
          {
            id: "inv_2",
            date: "2026-02-01T00:00:00.000Z",
            amount: 39,
            status: "paid",
            invoiceUrl: "https://example.com/inv_2",
          },
        ],
        isLoading: false,
      })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getAllByText("$39.00")).toHaveLength(2)
      expect(screen.getAllByText("Paid")).toHaveLength(2)
    })

    it("shows no payment history for free tier", () => {
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 0,
          conversationLimit: 5,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByText(/no payment history/i)).toBeTruthy()
    })
  })

  describe("action buttons", () => {
    it("shows upgrade button for free tier", () => {
      mockGetSubscription.mockReturnValue({ data: null, isLoading: false })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 3,
          conversationLimit: 5,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByRole("button", { name: /upgrade/i })).toBeTruthy()
    })

    it("shows manage payment button for subscribed user", () => {
      mockGetSubscription.mockReturnValue({
        data: {
          planId: "seeker_pro",
          planName: "Pro",
          status: "ACTIVE",
          monthlyPrice: 39,
          currentPeriodEnd: "2026-04-01",
          cancelAtPeriodEnd: false,
        },
        isLoading: false,
      })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 12,
          conversationLimit: null,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      expect(screen.getByRole("button", { name: /manage payment/i })).toBeTruthy()
    })

    it("calls createPortalSession on manage payment click", async () => {
      mockGetSubscription.mockReturnValue({
        data: {
          planId: "seeker_pro",
          planName: "Pro",
          status: "ACTIVE",
          monthlyPrice: 39,
          currentPeriodEnd: "2026-04-01",
          cancelAtPeriodEnd: false,
        },
        isLoading: false,
      })
      mockGetUsage.mockReturnValue({
        data: {
          conversationsThisMonth: 12,
          conversationLimit: null,
          activePostings: 0,
          postingLimit: null,
        },
        isLoading: false,
      })
      mockGetPaymentHistory.mockReturnValue({ data: [], isLoading: false })

      render(<BillingDashboard userType="JOB_SEEKER" />)

      const user = userEvent.setup()
      await user.click(screen.getByRole("button", { name: /manage payment/i }))

      expect(mockCreatePortalMutate).toHaveBeenCalled()
    })
  })
})
