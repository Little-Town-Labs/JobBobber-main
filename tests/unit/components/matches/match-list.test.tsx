// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MatchList } from "@/components/matches/match-list"

const MATCH = {
  id: "match_01",
  conversationId: "conv_01",
  jobPostingId: "post_01",
  seekerId: "seeker_01",
  employerId: "emp_01",
  confidenceScore: "STRONG",
  matchSummary: "Great fit.",
  seekerStatus: "PENDING",
  employerStatus: "PENDING",
  seekerContactInfo: null,
  seekerAvailability: null,
  isMutualAccept: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

describe("MatchList", () => {
  it("shows empty state for employer", () => {
    render(<MatchList matches={[]} role="employer" />)
    expect(screen.getByText("No matches yet.")).toBeInTheDocument()
    expect(screen.getByText(/AI evaluates candidates/)).toBeInTheDocument()
  })

  it("shows empty state for seeker", () => {
    render(<MatchList matches={[]} role="seeker" />)
    expect(screen.getByText(/employers find you/)).toBeInTheDocument()
  })

  it("renders match cards", () => {
    render(<MatchList matches={[MATCH]} role="employer" />)
    expect(screen.getByText("Great fit.")).toBeInTheDocument()
  })

  it("renders multiple matches", () => {
    const matches = [MATCH, { ...MATCH, id: "match_02", matchSummary: "Good potential." }]
    render(<MatchList matches={matches} role="employer" />)
    expect(screen.getByText("Great fit.")).toBeInTheDocument()
    expect(screen.getByText("Good potential.")).toBeInTheDocument()
  })
})
