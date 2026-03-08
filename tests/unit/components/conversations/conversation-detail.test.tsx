// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ConversationDetail } from "@/components/conversations/conversation-detail"

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    id: "conv_01",
    jobPostingTitle: "Senior Engineer",
    candidateName: null as string | null,
    status: "COMPLETED_MATCH",
    startedAt: "2026-03-07T10:00:00Z",
    completedAt: "2026-03-07T10:10:00Z",
    outcome: "Mutual match at turn 6",
    messages: [
      {
        role: "employer_agent" as const,
        content: "Let's discuss the role requirements.",
        phase: "discovery",
        timestamp: "2026-03-07T10:00:00Z",
        turnNumber: 1,
      },
      {
        role: "seeker_agent" as const,
        content: "I have experience with TypeScript and React.",
        phase: "discovery",
        timestamp: "2026-03-07T10:01:00Z",
        turnNumber: 2,
      },
      {
        role: "employer_agent" as const,
        content: "The compensation is [REDACTED] per year.",
        phase: "negotiation",
        timestamp: "2026-03-07T10:05:00Z",
        turnNumber: 5,
      },
    ],
    onBack: vi.fn(),
    ...overrides,
  }
}

describe("ConversationDetail", () => {
  it("renders messages in chronological order", () => {
    render(<ConversationDetail {...makeProps()} />)

    const messages = screen.getAllByText(/\.|experience|compensation/i)
    expect(messages.length).toBeGreaterThanOrEqual(3)
  })

  it("shows role attribution labels (not just color)", () => {
    render(<ConversationDetail {...makeProps()} />)

    expect(screen.getAllByText("Employer Agent").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Seeker Agent")).toBeInTheDocument()
  })

  it("shows timestamps per message", () => {
    const { container } = render(<ConversationDetail {...makeProps()} />)

    const timeElements = container.querySelectorAll("time")
    expect(timeElements.length).toBeGreaterThanOrEqual(3)
  })

  it("shows phase dividers", () => {
    render(<ConversationDetail {...makeProps()} />)

    expect(screen.getByText("Discovery")).toBeInTheDocument()
    expect(screen.getByText("Negotiation")).toBeInTheDocument()
  })

  it("displays [REDACTED] placeholders visibly", () => {
    render(<ConversationDetail {...makeProps()} />)

    expect(screen.getByText(/\[REDACTED\]/)).toBeInTheDocument()
  })

  it("shows 'in progress' indicator for IN_PROGRESS status", () => {
    render(<ConversationDetail {...makeProps({ status: "IN_PROGRESS" })} />)

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText(/still in progress/)).toBeInTheDocument()
  })

  it("calls onBack when back button clicked", () => {
    const onBack = vi.fn()
    render(<ConversationDetail {...makeProps({ onBack })} />)

    fireEvent.click(screen.getByLabelText("Back to conversation list"))
    expect(onBack).toHaveBeenCalled()
  })

  it("shows job posting title", () => {
    render(<ConversationDetail {...makeProps()} />)

    expect(screen.getByText("Senior Engineer")).toBeInTheDocument()
  })

  it("shows candidate name when present", () => {
    render(<ConversationDetail {...makeProps({ candidateName: "Jane Doe" })} />)

    expect(screen.getByText("Candidate: Jane Doe")).toBeInTheDocument()
  })

  it("renders empty state for conversation with no messages", () => {
    render(<ConversationDetail {...makeProps({ messages: [] })} />)

    expect(screen.getByText("No messages in this conversation yet.")).toBeInTheDocument()
  })

  it("has accessible log region", () => {
    render(<ConversationDetail {...makeProps()} />)

    expect(screen.getByRole("log")).toBeInTheDocument()
  })

  it("shows status badge", () => {
    render(<ConversationDetail {...makeProps()} />)

    expect(screen.getByRole("status")).toHaveTextContent("Matched")
  })

  it("shows outcome", () => {
    render(<ConversationDetail {...makeProps()} />)

    expect(screen.getByText("Mutual match at turn 6")).toBeInTheDocument()
  })
})
