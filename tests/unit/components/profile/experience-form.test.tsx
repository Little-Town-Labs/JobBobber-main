// @vitest-environment happy-dom
/**
 * Task 4.5 — ExperienceForm component tests
 *
 * Tests FAIL before src/components/profile/experience-form.tsx exists.
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
  id: "clxexp1234567890abcdefghi",
  jobTitle: "Software Engineer",
  company: "Acme Corp",
  startDate: "2022-01-01",
  endDate: null,
  description: "Built things.",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { ExperienceForm } from "@/components/profile/experience-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExperienceForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders existing experience entries", () => {
    render(<ExperienceForm experience={[ENTRY]} />)
    expect(screen.getByDisplayValue("Software Engineer")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument()
  })

  it("renders an 'Add experience' button", () => {
    render(<ExperienceForm experience={[]} />)
    expect(screen.getByRole("button", { name: /add experience/i })).toBeInTheDocument()
  })

  it("adds a blank entry form when 'Add experience' is clicked", async () => {
    const user = userEvent.setup()
    render(<ExperienceForm experience={[]} />)

    await user.click(screen.getByRole("button", { name: /add experience/i }))

    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument()
  })

  it("removes an entry when its Remove button is clicked", async () => {
    const user = userEvent.setup()
    render(<ExperienceForm experience={[ENTRY]} />)

    await user.click(screen.getByRole("button", { name: /remove/i }))

    expect(screen.queryByDisplayValue("Software Engineer")).not.toBeInTheDocument()
  })

  it("submits the full updated array on save", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ experience: [ENTRY], profileCompleteness: 35 })
    render(<ExperienceForm experience={[ENTRY]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ experience: expect.any(Array) }),
      )
    })
  })

  it("shows inline error when end date is before start date", async () => {
    const user = userEvent.setup()
    const invalidEntry = { ...ENTRY, startDate: "2023-06-01", endDate: "2022-01-01" }
    render(<ExperienceForm experience={[invalidEntry]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("shows inline error when description exceeds 2000 chars", async () => {
    const user = userEvent.setup()
    const longEntry = { ...ENTRY, description: "a".repeat(2001) }
    render(<ExperienceForm experience={[longEntry]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })
})
