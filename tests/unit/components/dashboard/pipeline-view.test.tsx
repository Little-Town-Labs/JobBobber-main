// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}))

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const { mockGetPipelineSummary } = vi.hoisted(() => ({
  mockGetPipelineSummary: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    dashboard: {
      getPipelineSummary: {
        useQuery: (...args: unknown[]) => mockGetPipelineSummary(...args),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { PipelineView } from "@/components/dashboard/pipeline-view"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PIPELINE_DATA = {
  postings: [
    {
      id: "post_01",
      title: "Senior React Developer",
      status: "ACTIVE",
      matchCounts: { total: 25, pending: 10, accepted: 12, declined: 3 },
      matchRate: 72,
      conversationMetrics: { total: 18, inProgress: 5, completed: 13 },
    },
    {
      id: "post_02",
      title: "Backend Engineer",
      status: "ACTIVE",
      matchCounts: { total: 15, pending: 8, accepted: 5, declined: 2 },
      matchRate: 45,
      conversationMetrics: { total: 10, inProgress: 3, completed: 7 },
    },
  ],
  totals: {
    totalPostings: 2,
    totalMatches: 40,
    totalPending: 18,
    totalAccepted: 17,
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PipelineView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("loading state", () => {
    it("shows loading skeleton while data loads", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: undefined,
        isLoading: true,
      })

      render(<PipelineView />)
      expect(screen.getByTestId("pipeline-loading")).toBeTruthy()
    })
  })

  describe("empty state", () => {
    it("shows empty state when no active postings", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: {
          postings: [],
          totals: {
            totalPostings: 0,
            totalMatches: 0,
            totalPending: 0,
            totalAccepted: 0,
          },
        },
        isLoading: false,
      })

      render(<PipelineView />)
      expect(screen.getByText(/no active postings/i)).toBeInTheDocument()
      expect(screen.getByRole("link", { name: /create a posting/i })).toBeInTheDocument()
    })
  })

  describe("posting rows", () => {
    it("renders posting titles", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: PIPELINE_DATA,
        isLoading: false,
      })

      render(<PipelineView />)
      expect(screen.getByText("Senior React Developer")).toBeInTheDocument()
      expect(screen.getByText("Backend Engineer")).toBeInTheDocument()
    })

    it("renders posting status", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: PIPELINE_DATA,
        isLoading: false,
      })

      render(<PipelineView />)
      const badges = screen.getAllByText("ACTIVE")
      expect(badges).toHaveLength(2)
    })

    it("renders match counts per posting", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: PIPELINE_DATA,
        isLoading: false,
      })

      render(<PipelineView />)
      // First posting match counts
      expect(screen.getByText("25")).toBeInTheDocument() // total
      expect(screen.getByText("10")).toBeInTheDocument() // pending
      expect(screen.getByText("12")).toBeInTheDocument() // accepted
      // Second posting
      expect(screen.getByText("15")).toBeInTheDocument() // total
    })

    it("shows match rate percentage per posting", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: PIPELINE_DATA,
        isLoading: false,
      })

      render(<PipelineView />)
      expect(screen.getByText("72%")).toBeInTheDocument()
      expect(screen.getByText("45%")).toBeInTheDocument()
    })
  })

  describe("totals row", () => {
    it("shows aggregate totals", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: PIPELINE_DATA,
        isLoading: false,
      })

      render(<PipelineView />)
      expect(screen.getByText("40")).toBeInTheDocument() // totalMatches
      expect(screen.getByText("18")).toBeInTheDocument() // totalPending
      expect(screen.getByText("17")).toBeInTheDocument() // totalAccepted
    })
  })

  describe("navigation", () => {
    it("has links to posting matches pages", () => {
      mockGetPipelineSummary.mockReturnValue({
        data: PIPELINE_DATA,
        isLoading: false,
      })

      render(<PipelineView />)
      const links = screen.getAllByRole("link")
      const matchLinks = links.filter(
        (link) =>
          link.getAttribute("href") === "/postings/post_01/matches" ||
          link.getAttribute("href") === "/postings/post_02/matches",
      )
      expect(matchLinks).toHaveLength(2)
    })
  })
})
