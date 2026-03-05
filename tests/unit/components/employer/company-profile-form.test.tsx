// @vitest-environment jsdom
/**
 * Task 4.1 — CompanyProfileForm component tests
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
    employers: {
      updateProfile: { useMutation: mockUseMutation },
    },
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYER = {
  id: "emp_01",
  name: "Acme Corp",
  description: "We build things.",
  industry: "Technology",
  size: "51-200",
  culture: "Fast-paced",
  headquarters: "San Francisco, CA",
  locations: ["San Francisco, CA"],
  websiteUrl: "https://acme.example.com",
  urls: {},
  benefits: ["Health Insurance"],
  logoUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { CompanyProfileForm } from "@/components/employer/company-profile-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompanyProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders all editable fields", () => {
    render(<CompanyProfileForm employer={EMPLOYER} />)
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/industry/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/size/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/culture/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/headquarters/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument()
  })

  it("populates fields with initial employer values", () => {
    render(<CompanyProfileForm employer={EMPLOYER} />)
    expect(screen.getByLabelText(/company name/i)).toHaveValue("Acme Corp")
    expect(screen.getByLabelText(/description/i)).toHaveValue("We build things.")
    expect(screen.getByLabelText(/industry/i)).toHaveValue("Technology")
  })

  it("validates required company name", async () => {
    const user = userEvent.setup()
    render(<CompanyProfileForm employer={{ ...EMPLOYER, name: "" }} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("validates website URL format", async () => {
    const user = userEvent.setup()
    render(<CompanyProfileForm employer={EMPLOYER} />)

    const websiteInput = screen.getByLabelText(/website/i)
    await user.clear(websiteInput)
    await user.type(websiteInput, "not-a-url")
    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("submits via mutateAsync with correct payload", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue(EMPLOYER)
    render(<CompanyProfileForm employer={EMPLOYER} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme Corp",
          description: "We build things.",
        }),
      )
    })
  })

  it("shows success message after save", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue(EMPLOYER)
    render(<CompanyProfileForm employer={EMPLOYER} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument()
    })
  })

  it("shows error message when mutation fails", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockRejectedValue(new Error("Server error"))
    render(<CompanyProfileForm employer={EMPLOYER} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("disables save button while pending", () => {
    mockUseMutation.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: true })
    render(<CompanyProfileForm employer={EMPLOYER} />)
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled()
  })
})
