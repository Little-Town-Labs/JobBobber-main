// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

const { mockBulkUpdateStatus } = vi.hoisted(() => ({
  mockBulkUpdateStatus: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      matches: {
        listForPosting: { invalidate: vi.fn() },
      },
    }),
    matches: {
      bulkUpdateStatus: {
        useMutation: () => ({
          mutateAsync: mockBulkUpdateStatus,
          isPending: false,
        }),
      },
    },
  },
}))

vi.mock("@/lib/csv-export", () => ({
  generateMatchCsv: vi.fn().mockReturnValue("csv-data"),
  downloadCsv: vi.fn(),
}))

import { BulkActionBar } from "@/components/matches/bulk-action-bar"
import { generateMatchCsv, downloadCsv } from "@/lib/csv-export"

const defaultProps = {
  selectedIds: ["m1", "m2", "m3"],
  totalCount: 10,
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  isAllSelected: false,
  jobPostingId: "post_01",
  onComplete: vi.fn(),
}

describe("BulkActionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // happy-dom may not have window.confirm defined
    window.confirm = vi.fn().mockReturnValue(true)
  })

  it("displays the count of selected items", () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument()
  })

  it("shows Select All button when not all selected", () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument()
  })

  it("shows Clear Selection button when some are selected", () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument()
  })

  it("calls onSelectAll when Select All is clicked", async () => {
    const user = userEvent.setup()
    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /select all/i }))
    expect(defaultProps.onSelectAll).toHaveBeenCalled()
  })

  it("calls onClearSelection when Clear is clicked", async () => {
    const user = userEvent.setup()
    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /clear/i }))
    expect(defaultProps.onClearSelection).toHaveBeenCalled()
  })

  it("disables batch buttons when no items selected", () => {
    render(<BulkActionBar {...defaultProps} selectedIds={[]} />)

    const acceptBtn = screen.getByRole("button", { name: /batch accept/i })
    const declineBtn = screen.getByRole("button", { name: /batch decline/i })

    expect(acceptBtn).toBeDisabled()
    expect(declineBtn).toBeDisabled()
  })

  it("enables batch buttons when items are selected", () => {
    render(<BulkActionBar {...defaultProps} />)

    const acceptBtn = screen.getByRole("button", { name: /batch accept/i })
    const declineBtn = screen.getByRole("button", { name: /batch decline/i })

    expect(acceptBtn).not.toBeDisabled()
    expect(declineBtn).not.toBeDisabled()
  })

  it("shows confirmation dialog before batch accept", async () => {
    const user = userEvent.setup()
    mockBulkUpdateStatus.mockResolvedValue({ updated: 3, skipped: 0, total: 3 })

    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /batch accept/i }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("3"))
  })

  it("calls bulkUpdateStatus with ACCEPTED on confirm", async () => {
    const user = userEvent.setup()
    mockBulkUpdateStatus.mockResolvedValue({ updated: 3, skipped: 0, total: 3 })

    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /batch accept/i }))

    expect(mockBulkUpdateStatus).toHaveBeenCalledWith({
      jobPostingId: "post_01",
      matchIds: ["m1", "m2", "m3"],
      status: "ACCEPTED",
    })
  })

  it("calls bulkUpdateStatus with DECLINED on batch decline", async () => {
    const user = userEvent.setup()
    mockBulkUpdateStatus.mockResolvedValue({ updated: 2, skipped: 1, total: 3 })

    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /batch decline/i }))

    expect(mockBulkUpdateStatus).toHaveBeenCalledWith({
      jobPostingId: "post_01",
      matchIds: ["m1", "m2", "m3"],
      status: "DECLINED",
    })
  })

  it("does not call bulkUpdateStatus if confirm is cancelled", async () => {
    const user = userEvent.setup()
    window.confirm = vi.fn().mockReturnValue(false)

    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /batch accept/i }))

    expect(mockBulkUpdateStatus).not.toHaveBeenCalled()
  })

  it("shows result summary after batch operation", async () => {
    const user = userEvent.setup()
    mockBulkUpdateStatus.mockResolvedValue({ updated: 3, skipped: 2, total: 5 })

    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /batch accept/i }))

    await waitFor(() => {
      expect(screen.getByText(/3 accepted/i)).toBeInTheDocument()
      expect(screen.getByText(/2 skipped/i)).toBeInTheDocument()
    })
  })

  it("shows result summary for decline operation", async () => {
    const user = userEvent.setup()
    mockBulkUpdateStatus.mockResolvedValue({ updated: 2, skipped: 1, total: 3 })

    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /batch decline/i }))

    await waitFor(() => {
      expect(screen.getByText(/2 declined/i)).toBeInTheDocument()
      expect(screen.getByText(/1 skipped/i)).toBeInTheDocument()
    })
  })

  it("calls onComplete after batch operation", async () => {
    const user = userEvent.setup()
    mockBulkUpdateStatus.mockResolvedValue({ updated: 3, skipped: 0, total: 3 })

    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /batch accept/i }))

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalled()
    })
  })

  it("renders a CSV export button", () => {
    render(<BulkActionBar {...defaultProps} />)
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument()
  })

  it("calls csv export utilities when export button is clicked", async () => {
    const user = userEvent.setup()
    render(<BulkActionBar {...defaultProps} />)
    await user.click(screen.getByRole("button", { name: /export csv/i }))

    expect(generateMatchCsv).toHaveBeenCalledWith([])
    expect(downloadCsv).toHaveBeenCalledWith("csv-data", expect.stringContaining(".csv"))
  })
})
