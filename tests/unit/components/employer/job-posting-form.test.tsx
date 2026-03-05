// @vitest-environment jsdom
/**
 * Task 5.1 — JobPostingForm component tests
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
      create: { useMutation: mockUseMutation },
      update: { useMutation: mockUseMutation },
    },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_POSTING = null

const EXISTING_POSTING = {
  id: "post_01",
  employerId: "emp_01",
  title: "Software Engineer",
  department: "Engineering",
  description: "Build great software.",
  responsibilities: "Write code",
  requiredSkills: ["TypeScript", "React"],
  preferredSkills: ["GraphQL"],
  experienceLevel: "MID",
  employmentType: "FULL_TIME",
  locationType: "REMOTE",
  locationReq: null,
  salaryMin: 80000,
  salaryMax: 120000,
  benefits: ["Health Insurance"],
  whyApply: "Great team",
  status: "DRAFT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { JobPostingForm } from "@/components/employer/job-posting-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JobPostingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders required fields (title, description)", () => {
    render(<JobPostingForm posting={EMPTY_POSTING} />)
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  })

  it("pre-fills form with existing posting data", () => {
    render(<JobPostingForm posting={EXISTING_POSTING} />)
    expect(screen.getByLabelText(/title/i)).toHaveValue("Software Engineer")
    expect(screen.getByLabelText(/description/i)).toHaveValue("Build great software.")
  })

  it("validates required title on submit", async () => {
    const user = userEvent.setup()
    render(<JobPostingForm posting={EMPTY_POSTING} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("validates required description on submit", async () => {
    const user = userEvent.setup()
    render(<JobPostingForm posting={EMPTY_POSTING} />)

    const titleInput = screen.getByLabelText(/title/i)
    await user.type(titleInput, "Engineer")
    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("validates salaryMax >= salaryMin", async () => {
    const user = userEvent.setup()
    const badSalary = {
      ...EXISTING_POSTING,
      salaryMin: 120000,
      salaryMax: 80000,
    }
    render(<JobPostingForm posting={badSalary} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("submits successfully with valid data", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue(EXISTING_POSTING)
    render(<JobPostingForm posting={EXISTING_POSTING} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled()
    })
  })

  it("shows error message when mutation fails", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockRejectedValue(new Error("Server error"))
    render(<JobPostingForm posting={EXISTING_POSTING} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("disables save button while pending", () => {
    mockUseMutation.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: true })
    render(<JobPostingForm posting={EMPTY_POSTING} />)
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled()
  })

  it("renders experience level select", () => {
    render(<JobPostingForm posting={EMPTY_POSTING} />)
    expect(screen.getByLabelText(/experience level/i)).toBeInTheDocument()
  })

  it("renders employment type select", () => {
    render(<JobPostingForm posting={EMPTY_POSTING} />)
    expect(screen.getByLabelText(/employment type/i)).toBeInTheDocument()
  })

  it("renders location type select", () => {
    render(<JobPostingForm posting={EMPTY_POSTING} />)
    expect(screen.getByLabelText(/location type/i)).toBeInTheDocument()
  })
})
