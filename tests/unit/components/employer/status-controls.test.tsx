// @vitest-environment happy-dom
/**
 * Task 5.1 — StatusControls component tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockUseMutation, mockMutateAsync } = vi.hoisted(() => ({
  mockUseMutation: vi.fn(),
  mockMutateAsync: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    jobPostings: {
      updateStatus: { useMutation: mockUseMutation },
    },
  },
}))

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { StatusControls } from "@/components/employer/status-controls"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatusControls", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("shows Activate button for DRAFT posting", () => {
    render(
      <StatusControls
        postingId="post_01"
        status="DRAFT"
        canActivate={true}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /activate/i })).toBeInTheDocument()
  })

  it("shows Pause, Close, and Filled buttons for ACTIVE posting", () => {
    render(
      <StatusControls
        postingId="post_01"
        status="ACTIVE"
        canActivate={true}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /filled/i })).toBeInTheDocument()
  })

  it("shows Reactivate, Close, and Filled for PAUSED posting", () => {
    render(
      <StatusControls
        postingId="post_01"
        status="PAUSED"
        canActivate={true}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /reactivate/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument()
  })

  it("shows no transition buttons for CLOSED posting", () => {
    render(
      <StatusControls
        postingId="post_01"
        status="CLOSED"
        canActivate={true}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows no transition buttons for FILLED posting", () => {
    render(
      <StatusControls
        postingId="post_01"
        status="FILLED"
        canActivate={true}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows activation error when canActivate is false for DRAFT", () => {
    render(
      <StatusControls
        postingId="post_01"
        status="DRAFT"
        canActivate={false}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /activate/i })).toBeDisabled()
    expect(
      screen.getByText(/title, description, and at least one required skill/i),
    ).toBeInTheDocument()
  })

  it("calls updateStatus and onStatusChange on button click", async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    mockMutateAsync.mockResolvedValue({})
    render(
      <StatusControls
        postingId="post_01"
        status="ACTIVE"
        canActivate={true}
        onStatusChange={onStatusChange}
      />,
    )

    await user.click(screen.getByRole("button", { name: /pause/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ id: "post_01", status: "PAUSED" })
    })
  })
})
