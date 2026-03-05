// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MatchCard } from "@/components/matches/match-card"

const BASE_MATCH = {
  id: "match_01",
  conversationId: "conv_01",
  jobPostingId: "post_01",
  seekerId: "seeker_01",
  employerId: "emp_01",
  confidenceScore: "STRONG",
  matchSummary: "Great candidate fit.",
  seekerStatus: "PENDING",
  employerStatus: "PENDING",
  seekerContactInfo: null,
  seekerAvailability: null,
  isMutualAccept: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

describe("MatchCard", () => {
  it("renders match summary and confidence", () => {
    render(<MatchCard match={BASE_MATCH} role="employer" />)
    expect(screen.getByText("Great candidate fit.")).toBeInTheDocument()
    expect(screen.getByText("STRONG")).toBeInTheDocument()
  })

  it("shows Accept/Decline buttons when PENDING", () => {
    render(<MatchCard match={BASE_MATCH} role="employer" />)
    expect(screen.getByText("Accept")).toBeInTheDocument()
    expect(screen.getByText("Decline")).toBeInTheDocument()
  })

  it("hides buttons when not PENDING", () => {
    render(<MatchCard match={{ ...BASE_MATCH, employerStatus: "ACCEPTED" }} role="employer" />)
    expect(screen.queryByText("Accept")).not.toBeInTheDocument()
  })

  it("calls onAccept with matchId", () => {
    const onAccept = vi.fn()
    render(<MatchCard match={BASE_MATCH} role="employer" onAccept={onAccept} />)
    fireEvent.click(screen.getByText("Accept"))
    expect(onAccept).toHaveBeenCalledWith("match_01")
  })

  it("calls onDecline with matchId", () => {
    const onDecline = vi.fn()
    render(<MatchCard match={BASE_MATCH} role="employer" onDecline={onDecline} />)
    fireEvent.click(screen.getByText("Decline"))
    expect(onDecline).toHaveBeenCalledWith("match_01")
  })

  it("shows contact info on mutual accept", () => {
    render(
      <MatchCard
        match={{
          ...BASE_MATCH,
          seekerStatus: "ACCEPTED",
          employerStatus: "ACCEPTED",
          isMutualAccept: true,
          seekerContactInfo: { name: "Jane", email: "jane@test.com" },
        }}
        role="employer"
      />,
    )
    expect(screen.getByText(/contact info revealed/i)).toBeInTheDocument()
  })

  it("hides contact info when not mutual accept", () => {
    render(<MatchCard match={BASE_MATCH} role="employer" />)
    expect(screen.queryByText(/contact info revealed/i)).not.toBeInTheDocument()
  })

  it("shows seeker perspective statuses for seeker role", () => {
    render(<MatchCard match={BASE_MATCH} role="seeker" />)
    expect(screen.getByText("Employer:")).toBeInTheDocument()
  })
})
