// @vitest-environment happy-dom
/**
 * Task 4.13 — LocationForm component tests
 *
 * Tests FAIL before src/components/profile/location-form.tsx exists.
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
    jobSeekers: {
      updateProfile: { useMutation: mockUseMutation },
    },
  },
}))

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { LocationForm } from "@/components/profile/location-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LocationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders location text input and relocation preference select", () => {
    render(<LocationForm location={null} relocationPreference="NOT_OPEN" />)
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/relocation preference/i)).toBeInTheDocument()
  })

  it("populates fields with provided values", () => {
    render(<LocationForm location="Austin, TX" relocationPreference="DOMESTIC" />)
    expect(screen.getByLabelText(/^location$/i)).toHaveValue("Austin, TX")
    const select = screen.getByLabelText(/relocation preference/i) as HTMLSelectElement
    expect(select.value).toBe("DOMESTIC")
  })

  it("renders all four relocation preference options", () => {
    render(<LocationForm location={null} relocationPreference="NOT_OPEN" />)
    expect(screen.getByRole("option", { name: /not open/i })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /domestic/i })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /international/i })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /remote only/i })).toBeInTheDocument()
  })

  it("submits location and relocationPreference on save", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ profileCompleteness: 20 })
    render(<LocationForm location="Austin, TX" relocationPreference="REMOTE_ONLY" />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        location: "Austin, TX",
        relocationPreference: "REMOTE_ONLY",
      })
    })
  })

  it("shows inline error when location exceeds 255 chars", async () => {
    const user = userEvent.setup()
    render(<LocationForm location={"a".repeat(256)} relocationPreference="NOT_OPEN" />)
    // Note: using queryAllByLabelText to avoid multi-match issue — label regex is exact

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })
})
