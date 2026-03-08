// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ConversationList } from "@/components/conversations/conversation-list"

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: "conv_01",
    jobPostingTitle: "Senior Engineer",
    status: "COMPLETED_MATCH",
    messageCount: 6,
    startedAt: "2026-03-07T10:00:00Z",
    completedAt: "2026-03-07T10:10:00Z",
    outcome: "Mutual match at turn 6",
    ...overrides,
  }
}

describe("ConversationList", () => {
  it("renders conversation summaries", () => {
    render(<ConversationList conversations={[makeSummary()]} role="seeker" onSelect={vi.fn()} />)

    expect(screen.getByText("Senior Engineer")).toBeInTheDocument()
    expect(screen.getByText("6 messages")).toBeInTheDocument()
    expect(screen.getByText("Matched")).toBeInTheDocument()
  })

  it("shows empty state for seeker", () => {
    render(<ConversationList conversations={[]} role="seeker" onSelect={vi.fn()} />)

    expect(screen.getByTestId("empty-state")).toBeInTheDocument()
    expect(screen.getByText("No conversations yet.")).toBeInTheDocument()
  })

  it("shows empty state for employer", () => {
    render(<ConversationList conversations={[]} role="employer" onSelect={vi.fn()} />)

    expect(screen.getByText(/candidates/)).toBeInTheDocument()
  })

  it("shows candidate name for employer role", () => {
    render(
      <ConversationList
        conversations={[makeSummary({ candidateName: "Jane Doe" })]}
        role="employer"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("calls onSelect when conversation clicked", () => {
    const onSelect = vi.fn()
    render(<ConversationList conversations={[makeSummary()]} role="seeker" onSelect={onSelect} />)

    fireEvent.click(screen.getByText("Senior Engineer"))
    expect(onSelect).toHaveBeenCalledWith("conv_01")
  })

  it("shows status badges with accessible role attribute", () => {
    render(
      <ConversationList
        conversations={[
          makeSummary({ id: "c1", status: "IN_PROGRESS" }),
          makeSummary({ id: "c2", status: "COMPLETED_MATCH" }),
          makeSummary({ id: "c3", status: "COMPLETED_NO_MATCH" }),
          makeSummary({ id: "c4", status: "TERMINATED" }),
        ]}
        role="seeker"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText("In Progress")).toBeInTheDocument()
    expect(screen.getByText("Matched")).toBeInTheDocument()
    expect(screen.getByText("No Match")).toBeInTheDocument()
    expect(screen.getByText("Terminated")).toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(4)
  })

  it("renders Load more button when hasMore", () => {
    const onLoadMore = vi.fn()
    render(
      <ConversationList
        conversations={[makeSummary()]}
        role="seeker"
        onSelect={vi.fn()}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    )

    const btn = screen.getByText("Load more")
    fireEvent.click(btn)
    expect(onLoadMore).toHaveBeenCalled()
  })

  it("does not render Load more when hasMore is false", () => {
    render(
      <ConversationList
        conversations={[makeSummary()]}
        role="seeker"
        onSelect={vi.fn()}
        hasMore={false}
      />,
    )

    expect(screen.queryByText("Load more")).not.toBeInTheDocument()
  })

  it("shows outcome when present", () => {
    render(
      <ConversationList
        conversations={[makeSummary({ outcome: "Mutual match at turn 6" })]}
        role="seeker"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText("Mutual match at turn 6")).toBeInTheDocument()
  })
})
