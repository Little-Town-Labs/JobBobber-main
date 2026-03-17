// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

// Component under test (does not exist yet — RED phase)
import { MetricsPostingTable } from "@/components/dashboard/metrics-posting-table"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const POSTINGS = [
  {
    id: "post_01",
    title: "Software Engineer",
    status: "ACTIVE",
    createdAt: new Date("2026-01-15"),
    firstMatchAt: new Date("2026-01-16"),
    firstMutualAcceptAt: new Date("2026-01-20"),
    timeToFirstMatchMs: 1 * 24 * 60 * 60 * 1000, // 1 day
    timeToMutualAcceptMs: 3 * 24 * 60 * 60 * 1000, // 3 days (below 5d avg)
    totalMatches: 10,
    totalAccepts: 4,
  },
  {
    id: "post_02",
    title: "Product Manager",
    status: "ACTIVE",
    createdAt: new Date("2026-01-10"),
    firstMatchAt: new Date("2026-01-14"),
    firstMutualAcceptAt: null,
    timeToFirstMatchMs: 4 * 24 * 60 * 60 * 1000, // 4 days
    timeToMutualAcceptMs: null,
    totalMatches: 3,
    totalAccepts: 0,
  },
  {
    id: "post_03",
    title: "Designer",
    status: "CLOSED",
    createdAt: new Date("2026-01-05"),
    firstMatchAt: null,
    firstMutualAcceptAt: null,
    timeToFirstMatchMs: null,
    timeToMutualAcceptMs: null,
    totalMatches: 0,
    totalAccepts: 0,
  },
]

const AGGREGATES = {
  avgTimeToFirstMatchMs: 2.5 * 24 * 60 * 60 * 1000, // 2.5 days avg
  avgTimeToMutualAcceptMs: 5 * 24 * 60 * 60 * 1000, // 5 days avg
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MetricsPostingTable", () => {
  describe("rendering", () => {
    it("renders all posting rows", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      expect(screen.getByText("Software Engineer")).toBeInTheDocument()
      expect(screen.getByText("Product Manager")).toBeInTheDocument()
      expect(screen.getByText("Designer")).toBeInTheDocument()
    })

    it("renders column headers", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      expect(screen.getByText("Title")).toBeInTheDocument()
      expect(screen.getByText("Status")).toBeInTheDocument()
      expect(screen.getByText("Created")).toBeInTheDocument()
      expect(screen.getByText(/first match/i)).toBeInTheDocument()
      expect(screen.getByText(/mutual accept/i)).toBeInTheDocument()
      expect(screen.getByText("Matches")).toBeInTheDocument()
      expect(screen.getByText("Accepts")).toBeInTheDocument()
    })

    it("shows formatted time values using formatDuration", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      // 1 day for Software Engineer's time to first match
      expect(screen.getByText("1 day")).toBeInTheDocument()
      // 4 days for Product Manager's time to first match
      expect(screen.getByText("4 days")).toBeInTheDocument()
    })
  })

  describe("edge cases", () => {
    it("shows 'No matches yet' for zero-match postings", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      // Designer has 0 matches — both time columns show "No matches yet"
      const noMatches = screen.getAllByText("No matches yet")
      expect(noMatches.length).toBeGreaterThanOrEqual(1)
    })

    it("shows 'Pending' for postings with matches but no mutual accept", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      // Product Manager has matches but no mutual accept
      expect(screen.getByText("Pending")).toBeInTheDocument()
    })

    it("renders empty state when no postings exist", () => {
      render(<MetricsPostingTable postings={[]} aggregates={AGGREGATES} />)

      expect(screen.getByText(/no postings/i)).toBeInTheDocument()
    })
  })

  describe("sorting", () => {
    it("sorts by title when Title header is clicked", async () => {
      const user = userEvent.setup()
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      await user.click(screen.getByText("Title"))

      const rows = screen.getAllByRole("row")
      // Header row + 3 data rows; first data row should be "Designer" (alphabetical)
      const firstDataRow = rows[1]!
      expect(within(firstDataRow).getByText("Designer")).toBeInTheDocument()
    })

    it("sorts by matches when Matches header is clicked", async () => {
      const user = userEvent.setup()
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      await user.click(screen.getByText("Matches"))

      const rows = screen.getAllByRole("row")
      // Descending by matches: Software Engineer (10) first
      const firstDataRow = rows[1]!
      expect(within(firstDataRow).getByText("Software Engineer")).toBeInTheDocument()
    })

    it("toggles sort direction on second click", async () => {
      const user = userEvent.setup()
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      // First click: ascending by title
      await user.click(screen.getByText("Title"))
      // Second click: descending by title
      await user.click(screen.getByText("Title"))

      const rows = screen.getAllByRole("row")
      const firstDataRow = rows[1]!
      expect(within(firstDataRow).getByText("Software Engineer")).toBeInTheDocument()
    })
  })

  describe("highlighting", () => {
    it("applies green tint to rows where time is below average", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      // Software Engineer: 1 day first match (below 2.5 day avg) — should have green tint
      const row = screen.getByText("Software Engineer").closest("tr")!
      expect(row.className).toMatch(/green/)
    })

    it("applies red tint to rows where time is above average", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      // Product Manager: 4 days first match (above 2.5 day avg) — should have red tint
      const row = screen.getByText("Product Manager").closest("tr")!
      expect(row.className).toMatch(/red/)
    })

    it("does not highlight rows with no match data", () => {
      render(<MetricsPostingTable postings={POSTINGS} aggregates={AGGREGATES} />)

      // Designer: no matches — no highlight
      const row = screen.getByText("Designer").closest("tr")!
      expect(row.className).not.toMatch(/green|red/)
    })
  })
})
