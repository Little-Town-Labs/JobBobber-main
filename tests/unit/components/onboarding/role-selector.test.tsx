// @vitest-environment happy-dom
/**
 * T4.1 — RoleSelectorForm component tests
 *
 * Tests user interactions with the role selection form:
 * - Radio button selection (JOB_SEEKER / EMPLOYER)
 * - Conditional company name field for EMPLOYER
 * - Form submission → tRPC mutation call
 * - Redirect on success
 * - Error display on failure
 * - Disabled state during pending mutation
 *
 * Tests must FAIL before the component exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Hoisted mocks (must be at top — vi.mock is hoisted by Vite)
// ---------------------------------------------------------------------------

const { mockUseMutation, mockMutateAsync, mockPush } = vi.hoisted(() => ({
  mockUseMutation: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    onboarding: {
      setRole: {
        useMutation: mockUseMutation,
      },
    },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

// ---------------------------------------------------------------------------
// Import component under test (after mocks are set up)
// ---------------------------------------------------------------------------

import { RoleSelectorForm } from "@/components/onboarding/role-selector"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RoleSelectorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it("renders role selection options", () => {
    render(<RoleSelectorForm />)
    expect(screen.getByLabelText(/job seeker/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/employer/i)).toBeInTheDocument()
  })

  it("renders a submit button", () => {
    render(<RoleSelectorForm />)
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument()
  })

  it("hides company name field by default (no role selected)", () => {
    render(<RoleSelectorForm />)
    expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument()
  })

  it("hides company name field when JOB_SEEKER is selected", async () => {
    const user = userEvent.setup()
    render(<RoleSelectorForm />)
    await user.click(screen.getByLabelText(/job seeker/i))
    expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument()
  })

  it("shows company name field when EMPLOYER is selected", async () => {
    const user = userEvent.setup()
    render(<RoleSelectorForm />)
    await user.click(screen.getByLabelText(/employer/i))
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
  })

  it("submits JOB_SEEKER role without company name", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ success: true, redirectTo: "/setup/api-key" })
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/job seeker/i))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ role: "JOB_SEEKER" })
    })
  })

  it("submits EMPLOYER role with company name", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ success: true, redirectTo: "/setup/api-key" })
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/employer/i))
    await user.type(screen.getByLabelText(/company name/i), "Acme Corp")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        role: "EMPLOYER",
        companyName: "Acme Corp",
      })
    })
  })

  it("redirects to the path returned by the mutation", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ success: true, redirectTo: "/setup/api-key" })
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/job seeker/i))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/setup/api-key")
    })
  })

  it("displays an error alert when the mutation fails", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockRejectedValue(new Error("Failed to create account"))
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/job seeker/i))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("shows validation error when EMPLOYER is submitted without company name", async () => {
    const user = userEvent.setup()
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/employer/i))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(screen.getByText(/company name is required/i)).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("disables the submit button while the mutation is pending", () => {
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    })
    render(<RoleSelectorForm />)
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled()
  })
})
