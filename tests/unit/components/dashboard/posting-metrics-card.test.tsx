// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const { mockGetPostingMetrics } = vi.hoisted(() => ({
  mockGetPostingMetrics: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    dashboard: {
      getPostingMetrics: {
        useQuery: (...args: unknown[]) => mockGetPostingMetrics(...args),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { PostingMetricsCard } from "@/components/dashboard/posting-metrics-card"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const METRICS_DATA = {
  totalConversations: 18,
  inProgressConversations: 5,
  completedEvaluations: 13,
  matchRate: 72,
  matchCounts: { total: 25, pending: 10, accepted: 12, declined: 3 },
}

const ZERO_METRICS = {
  totalConversations: 0,
  inProgressConversations: 0,
  completedEvaluations: 0,
  matchRate: 0,
  matchCounts: { total: 0, pending: 0, accepted: 0, declined: 0 },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PostingMetricsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("loading state", () => {
    it("shows loading skeleton while data loads", () => {
      mockGetPostingMetrics.mockReturnValue({
        data: undefined,
        isLoading: true,
      })

      render(<PostingMetricsCard jobPostingId="post_01" />)
      expect(screen.getByTestId("metrics-loading")).toBeTruthy()
    })
  })

  describe("conversation metrics", () => {
    it("renders total conversations", () => {
      mockGetPostingMetrics.mockReturnValue({
        data: METRICS_DATA,
        isLoading: false,
      })

      render(<PostingMetricsCard jobPostingId="post_01" />)
      expect(screen.getByText("18")).toBeInTheDocument()
      expect(screen.getByText(/total conversations/i)).toBeInTheDocument()
    })

    it("renders in-progress conversations", () => {
      mockGetPostingMetrics.mockReturnValue({
        data: METRICS_DATA,
        isLoading: false,
      })

      render(<PostingMetricsCard jobPostingId="post_01" />)
      expect(screen.getByText("5")).toBeInTheDocument()
      expect(screen.getByText(/in.progress/i)).toBeInTheDocument()
    })

    it("renders completed evaluations", () => {
      mockGetPostingMetrics.mockReturnValue({
        data: METRICS_DATA,
        isLoading: false,
      })

      render(<PostingMetricsCard jobPostingId="post_01" />)
      expect(screen.getByText("13")).toBeInTheDocument()
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })
  })

  describe("match rate", () => {
    it("shows match rate percentage", () => {
      mockGetPostingMetrics.mockReturnValue({
        data: METRICS_DATA,
        isLoading: false,
      })

      render(<PostingMetricsCard jobPostingId="post_01" />)
      expect(screen.getByText("72%")).toBeInTheDocument()
      expect(screen.getByText(/match rate/i)).toBeInTheDocument()
    })
  })

  describe("zero state", () => {
    it("shows zero values for new postings, not blank", () => {
      mockGetPostingMetrics.mockReturnValue({
        data: ZERO_METRICS,
        isLoading: false,
      })

      render(<PostingMetricsCard jobPostingId="post_01" />)
      // All zeros should be rendered as "0", not blank or hidden
      const zeros = screen.getAllByText("0")
      expect(zeros.length).toBeGreaterThanOrEqual(4)
      expect(screen.getByText("0%")).toBeInTheDocument()
    })
  })

  describe("tRPC query", () => {
    it("passes jobPostingId to the query", () => {
      mockGetPostingMetrics.mockReturnValue({
        data: METRICS_DATA,
        isLoading: false,
      })

      render(<PostingMetricsCard jobPostingId="post_42" />)
      expect(mockGetPostingMetrics).toHaveBeenCalledWith({ jobPostingId: "post_42" })
    })
  })
})
