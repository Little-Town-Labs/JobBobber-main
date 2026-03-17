// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// Component under test (does not exist yet — RED phase)
import { MetricsSummaryCards } from "@/components/dashboard/metrics-summary-cards"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_AGGREGATES = {
  avgTimeToFirstMatchMs: 2 * 24 * 60 * 60 * 1000, // 2 days
  avgTimeToMutualAcceptMs: 5 * 24 * 60 * 60 * 1000, // 5 days
  totalPostings: 12,
  totalMatches: 45,
  totalAccepts: 18,
  postingsWithMatches: 8,
}

const IMPROVING_TRENDS = {
  timeToFirstMatch: "improving" as const,
  timeToMutualAccept: "improving" as const,
  matchVolume: "improving" as const,
}

const DECLINING_TRENDS = {
  timeToFirstMatch: "declining" as const,
  timeToMutualAccept: "declining" as const,
  matchVolume: "declining" as const,
}

const STABLE_TRENDS = {
  timeToFirstMatch: "stable" as const,
  timeToMutualAccept: "stable" as const,
  matchVolume: "stable" as const,
}

const NULL_TRENDS = {
  timeToFirstMatch: null,
  timeToMutualAccept: null,
  matchVolume: null,
}

const EMPTY_AGGREGATES = {
  avgTimeToFirstMatchMs: null,
  avgTimeToMutualAcceptMs: null,
  totalPostings: 0,
  totalMatches: 0,
  totalAccepts: 0,
  postingsWithMatches: 0,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MetricsSummaryCards", () => {
  describe("KPI values", () => {
    it("renders all 5 KPI cards with correct values", () => {
      render(<MetricsSummaryCards aggregates={FULL_AGGREGATES} trends={IMPROVING_TRENDS} />)

      // Time values via formatDuration
      expect(screen.getByText("2 days")).toBeInTheDocument()
      expect(screen.getByText("5 days")).toBeInTheDocument()

      // Count values
      expect(screen.getByText("12")).toBeInTheDocument()
      expect(screen.getByText("45")).toBeInTheDocument()
      expect(screen.getByText("18")).toBeInTheDocument()
    })

    it("renders card labels", () => {
      render(<MetricsSummaryCards aggregates={FULL_AGGREGATES} trends={IMPROVING_TRENDS} />)

      expect(screen.getByText(/avg time to first match/i)).toBeInTheDocument()
      expect(screen.getByText(/avg time to mutual accept/i)).toBeInTheDocument()
      expect(screen.getByText(/total postings/i)).toBeInTheDocument()
      expect(screen.getByText(/total matches/i)).toBeInTheDocument()
      expect(screen.getByText(/total accepts/i)).toBeInTheDocument()
    })

    it("renders null time values as dash", () => {
      render(<MetricsSummaryCards aggregates={EMPTY_AGGREGATES} trends={NULL_TRENDS} />)

      // Null avgTimeToFirstMatchMs and avgTimeToMutualAcceptMs should show "—"
      const dashes = screen.getAllByText("—")
      expect(dashes.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("trend indicators", () => {
    it("shows green up-arrow for improving trends", () => {
      render(<MetricsSummaryCards aggregates={FULL_AGGREGATES} trends={IMPROVING_TRENDS} />)

      const improvingIndicators = screen.getAllByTestId("trend-improving")
      expect(improvingIndicators.length).toBeGreaterThanOrEqual(1)
      // Verify green coloring
      improvingIndicators.forEach((el) => {
        expect(el.className).toMatch(/green/)
      })
    })

    it("shows red down-arrow for declining trends", () => {
      render(<MetricsSummaryCards aggregates={FULL_AGGREGATES} trends={DECLINING_TRENDS} />)

      const decliningIndicators = screen.getAllByTestId("trend-declining")
      expect(decliningIndicators.length).toBeGreaterThanOrEqual(1)
      decliningIndicators.forEach((el) => {
        expect(el.className).toMatch(/red/)
      })
    })

    it("shows gray dash for stable trends", () => {
      render(<MetricsSummaryCards aggregates={FULL_AGGREGATES} trends={STABLE_TRENDS} />)

      const stableIndicators = screen.getAllByTestId("trend-stable")
      expect(stableIndicators.length).toBeGreaterThanOrEqual(1)
      stableIndicators.forEach((el) => {
        expect(el.className).toMatch(/gray/)
      })
    })

    it("hides trend indicator when trend is null", () => {
      render(<MetricsSummaryCards aggregates={FULL_AGGREGATES} trends={NULL_TRENDS} />)

      expect(screen.queryAllByTestId(/^trend-/)).toHaveLength(0)
    })
  })

  describe("edge cases", () => {
    it("shows 'Based on 1 posting' when postingsWithMatches is 1", () => {
      const singlePostingAggregates = {
        ...FULL_AGGREGATES,
        postingsWithMatches: 1,
      }

      render(<MetricsSummaryCards aggregates={singlePostingAggregates} trends={IMPROVING_TRENDS} />)

      expect(screen.getByText(/based on 1 posting/i)).toBeInTheDocument()
    })

    it("shows 'Based on N postings' for multiple postings with matches", () => {
      render(<MetricsSummaryCards aggregates={FULL_AGGREGATES} trends={IMPROVING_TRENDS} />)

      expect(screen.getByText(/based on 8 postings/i)).toBeInTheDocument()
    })

    it("shows empty state when no postings exist", () => {
      render(<MetricsSummaryCards aggregates={EMPTY_AGGREGATES} trends={NULL_TRENDS} />)

      // All count values should render as "0"
      const zeros = screen.getAllByText("0")
      expect(zeros.length).toBeGreaterThanOrEqual(3)
    })

    it("renders improving trend as green for time cards (lower is better)", () => {
      // For time metrics, "improving" means time decreased — still green up-arrow
      render(
        <MetricsSummaryCards
          aggregates={FULL_AGGREGATES}
          trends={{ ...STABLE_TRENDS, timeToFirstMatch: "improving" }}
        />,
      )

      const improving = screen.getAllByTestId("trend-improving")
      expect(improving.length).toBe(1)
    })
  })
})
