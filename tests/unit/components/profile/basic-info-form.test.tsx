// @vitest-environment happy-dom
/**
 * Task 4.3 — BasicInfoForm component tests
 *
 * Tests FAIL before src/components/profile/basic-info-form.tsx exists.
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
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE = {
  name: "Jane Smith",
  headline: "Senior Engineer",
  bio: "I build things.",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { BasicInfoForm } from "@/components/profile/basic-info-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BasicInfoForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders name, headline, and bio fields", () => {
    render(<BasicInfoForm profile={PROFILE} />)
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/headline/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument()
  })

  it("populates fields with initial profile values", () => {
    render(<BasicInfoForm profile={PROFILE} />)
    expect(screen.getByLabelText(/^name/i)).toHaveValue("Jane Smith")
    expect(screen.getByLabelText(/headline/i)).toHaveValue("Senior Engineer")
    expect(screen.getByLabelText(/bio/i)).toHaveValue("I build things.")
  })

  it("calls updateProfile with name, headline, and bio on submit", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ ...PROFILE, profileCompleteness: 40 })
    render(<BasicInfoForm profile={PROFILE} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: "Jane Smith",
        headline: "Senior Engineer",
        bio: "I build things.",
      })
    })
  })

  it("shows inline error when name is empty on submit", async () => {
    const user = userEvent.setup()
    render(<BasicInfoForm profile={{ ...PROFILE, name: "" }} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("shows inline error when headline exceeds 255 chars", async () => {
    const user = userEvent.setup()
    const longHeadline = "a".repeat(256)
    render(<BasicInfoForm profile={{ ...PROFILE, headline: longHeadline }} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("shows inline error when bio exceeds 2000 chars", async () => {
    const user = userEvent.setup()
    const longBio = "a".repeat(2001)
    render(<BasicInfoForm profile={{ ...PROFILE, bio: longBio }} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("shows loading state on the submit button while pending", () => {
    mockUseMutation.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: true })
    render(<BasicInfoForm profile={PROFILE} />)
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled()
  })

  it("shows success message after successful save", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ ...PROFILE, profileCompleteness: 40 })
    render(<BasicInfoForm profile={PROFILE} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument()
    })
  })

  it("shows error message when mutation fails", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockRejectedValue(new Error("Server error"))
    render(<BasicInfoForm profile={PROFILE} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })
})
