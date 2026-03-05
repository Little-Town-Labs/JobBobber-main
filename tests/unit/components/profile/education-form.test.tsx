// @vitest-environment jsdom
/**
 * Task 4.7 — EducationForm component tests
 *
 * Tests FAIL before src/components/profile/education-form.tsx exists.
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

const ENTRY = {
  id: "clxedu1234567890abcdefghi",
  institution: "State University",
  degree: "Bachelor of Science",
  fieldOfStudy: "Computer Science",
  startDate: "2016-09-01",
  endDate: "2020-05-01",
  description: "Graduated with honors.",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { EducationForm } from "@/components/profile/education-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EducationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders existing education entries", () => {
    render(<EducationForm education={[ENTRY]} />)
    expect(screen.getByDisplayValue("State University")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Computer Science")).toBeInTheDocument()
  })

  it("renders an 'Add education' button", () => {
    render(<EducationForm education={[]} />)
    expect(screen.getByRole("button", { name: /add education/i })).toBeInTheDocument()
  })

  it("adds a blank entry when 'Add education' is clicked", async () => {
    const user = userEvent.setup()
    render(<EducationForm education={[]} />)

    await user.click(screen.getByRole("button", { name: /add education/i }))

    expect(screen.getByLabelText(/institution/i)).toBeInTheDocument()
  })

  it("removes an entry when Remove is clicked", async () => {
    const user = userEvent.setup()
    render(<EducationForm education={[ENTRY]} />)

    await user.click(screen.getByRole("button", { name: /remove/i }))

    expect(screen.queryByDisplayValue("State University")).not.toBeInTheDocument()
  })

  it("submits complete education array on save", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ education: [ENTRY], profileCompleteness: 25 })
    render(<EducationForm education={[ENTRY]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ education: expect.any(Array) }),
      )
    })
  })

  it("shows inline error when description exceeds 1000 chars", async () => {
    const user = userEvent.setup()
    const longEntry = { ...ENTRY, description: "a".repeat(1001) }
    render(<EducationForm education={[longEntry]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })
})
