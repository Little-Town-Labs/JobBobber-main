// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

const { mockGetForComparison, mockUpdateStatus } = vi.hoisted(() => ({
  mockGetForComparison: vi.fn(),
  mockUpdateStatus: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      matches: {
        listForPosting: { invalidate: vi.fn() },
      },
    }),
    matches: {
      getForComparison: {
        useQuery: (...args: unknown[]) => mockGetForComparison(...args),
      },
      updateStatus: {
        useMutation: () => ({
          mutateAsync: mockUpdateStatus,
          isPending: false,
        }),
      },
    },
  },
}))

import { CandidateComparison } from "@/components/matches/candidate-comparison"

function makeCandidates(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    matchId: `match_${i}`,
    confidenceScore: (["STRONG", "GOOD", "POTENTIAL"] as const)[i % 3],
    matchSummary: `Summary for candidate ${i}`,
    evaluationData: null,
    seekerName: `Candidate ${i}`,
    seekerSkills: [`skill_a_${i}`, `skill_b_${i}`],
    seekerExperienceLevel: "MID",
    seekerLocation: "Remote",
    employerStatus: "PENDING" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  }))
}

describe("CandidateComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a prompt when fewer than 2 candidates are provided", () => {
    mockGetForComparison.mockReturnValue({ data: undefined, isLoading: false })

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0"]} />)

    expect(screen.getByText(/select at least 2 candidates/i)).toBeInTheDocument()
  })

  it("shows loading state while data is loading", () => {
    mockGetForComparison.mockReturnValue({ data: undefined, isLoading: true })

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it("renders side-by-side cards for 2 candidates", () => {
    const candidates = makeCandidates(2)
    mockGetForComparison.mockReturnValue({ data: candidates, isLoading: false })

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />)

    expect(screen.getByText("Candidate 0")).toBeInTheDocument()
    expect(screen.getByText("Candidate 1")).toBeInTheDocument()
  })

  it("renders up to 4 candidates in a grid", () => {
    const candidates = makeCandidates(4)
    mockGetForComparison.mockReturnValue({ data: candidates, isLoading: false })

    const { container } = render(
      <CandidateComparison
        jobPostingId="post_01"
        matchIds={["match_0", "match_1", "match_2", "match_3"]}
      />,
    )

    expect(screen.getByText("Candidate 0")).toBeInTheDocument()
    expect(screen.getByText("Candidate 3")).toBeInTheDocument()
    // grid should have 4 columns class
    const grid = container.querySelector("[data-testid='comparison-grid']")
    expect(grid).toBeInTheDocument()
    expect(grid?.className).toContain("grid-cols-4")
  })

  it("uses grid-cols-2 for 2 candidates and grid-cols-3 for 3", () => {
    const candidates2 = makeCandidates(2)
    mockGetForComparison.mockReturnValue({ data: candidates2, isLoading: false })

    const { container, unmount } = render(
      <CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />,
    )

    const grid2 = container.querySelector("[data-testid='comparison-grid']")
    expect(grid2?.className).toContain("grid-cols-2")
    unmount()

    const candidates3 = makeCandidates(3)
    mockGetForComparison.mockReturnValue({ data: candidates3, isLoading: false })

    const { container: c3 } = render(
      <CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1", "match_2"]} />,
    )

    const grid3 = c3.querySelector("[data-testid='comparison-grid']")
    expect(grid3?.className).toContain("grid-cols-3")
  })

  it("displays confidence score, summary, skills, experience, and location", () => {
    const candidates = makeCandidates(2)
    mockGetForComparison.mockReturnValue({ data: candidates, isLoading: false })

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />)

    // Candidate 0
    expect(screen.getByText("STRONG")).toBeInTheDocument()
    expect(screen.getByText("Summary for candidate 0")).toBeInTheDocument()
    expect(screen.getByText("skill_a_0")).toBeInTheDocument()
    expect(screen.getByText("skill_b_0")).toBeInTheDocument()
    expect(screen.getAllByText("MID").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Remote").length).toBeGreaterThanOrEqual(1)
  })

  it("renders accept and decline buttons for each pending candidate", () => {
    const candidates = makeCandidates(2)
    mockGetForComparison.mockReturnValue({ data: candidates, isLoading: false })

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />)

    const acceptButtons = screen.getAllByRole("button", { name: /accept/i })
    const declineButtons = screen.getAllByRole("button", { name: /decline/i })

    expect(acceptButtons).toHaveLength(2)
    expect(declineButtons).toHaveLength(2)
  })

  it("calls updateStatus with ACCEPTED when accept is clicked", async () => {
    const user = userEvent.setup()
    const candidates = makeCandidates(2)
    mockGetForComparison.mockReturnValue({ data: candidates, isLoading: false })
    mockUpdateStatus.mockResolvedValue({})

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />)

    const acceptButtons = screen.getAllByRole("button", { name: /accept/i })
    await user.click(acceptButtons[0])

    expect(mockUpdateStatus).toHaveBeenCalledWith({
      jobPostingId: "post_01",
      matchId: "match_0",
      status: "ACCEPTED",
    })
  })

  it("calls updateStatus with DECLINED when decline is clicked", async () => {
    const user = userEvent.setup()
    const candidates = makeCandidates(2)
    mockGetForComparison.mockReturnValue({ data: candidates, isLoading: false })
    mockUpdateStatus.mockResolvedValue({})

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />)

    const declineButtons = screen.getAllByRole("button", { name: /decline/i })
    await user.click(declineButtons[1])

    expect(mockUpdateStatus).toHaveBeenCalledWith({
      jobPostingId: "post_01",
      matchId: "match_1",
      status: "DECLINED",
    })
  })

  it("does not show accept/decline for non-pending candidates", () => {
    const candidates = makeCandidates(2).map((c) => ({
      ...c,
      employerStatus: "ACCEPTED" as const,
    }))
    mockGetForComparison.mockReturnValue({ data: candidates, isLoading: false })

    render(<CandidateComparison jobPostingId="post_01" matchIds={["match_0", "match_1"]} />)

    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /decline/i })).not.toBeInTheDocument()
  })

  it("passes jobPostingId and matchIds to the query", () => {
    mockGetForComparison.mockReturnValue({ data: undefined, isLoading: true })

    render(<CandidateComparison jobPostingId="post_99" matchIds={["m1", "m2"]} />)

    expect(mockGetForComparison).toHaveBeenCalledWith(
      { jobPostingId: "post_99", matchIds: ["m1", "m2"] },
      expect.anything(),
    )
  })
})
