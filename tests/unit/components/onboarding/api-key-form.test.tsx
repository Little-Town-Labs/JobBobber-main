// @vitest-environment happy-dom
/**
 * T4.3 — ByokSetupForm component tests
 *
 * Tests the API key submission form used during onboarding (/setup/api-key)
 * and from the ApiKeyManager when adding/changing a key:
 * - Provider selection (openai / anthropic)
 * - API key input
 * - Form submission → trpc.byok.storeKey mutation
 * - Success callback invocation
 * - Error display on failure
 * - Loading state during submission
 *
 * Tests must FAIL before the component exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockUseMutation, mockMutateAsync } = vi.hoisted(() => ({
  mockUseMutation: vi.fn(),
  mockMutateAsync: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    byok: {
      storeKey: {
        useMutation: mockUseMutation,
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { ByokSetupForm } from "@/components/onboarding/api-key-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ByokSetupForm", () => {
  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it("renders provider selection and API key input", () => {
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)
    expect(screen.getByLabelText(/provider/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument()
  })

  it("renders a submit button", () => {
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)
    expect(screen.getByRole("button", { name: /save|add|submit/i })).toBeInTheDocument()
  })

  it("defaults to openai provider", () => {
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)
    const select = screen.getByLabelText(/provider/i) as HTMLSelectElement
    expect(select.value).toBe("openai")
  })

  it("allows selecting anthropic as the provider", async () => {
    const user = userEvent.setup()
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.selectOptions(screen.getByLabelText(/provider/i), "anthropic")
    const select = screen.getByLabelText(/provider/i) as HTMLSelectElement
    expect(select.value).toBe("anthropic")
  })

  it("submits with selected provider and api key", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({
      success: true,
      provider: "openai",
      maskedKey: "sk-pro...abcd",
    })
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        provider: "openai",
        apiKey: "sk-proj-testkey123",
      })
    })
  })

  it("calls onSuccess callback with result after successful submission", async () => {
    const user = userEvent.setup()
    const result = { success: true as const, provider: "openai", maskedKey: "sk-pro...abcd" }
    mockMutateAsync.mockResolvedValue(result)
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(result)
    })
  })

  it("displays an error alert when the mutation fails", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockRejectedValue(new Error("Invalid API key"))
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-invalid")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("shows validation error when API key is empty", async () => {
    const user = userEvent.setup()
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/api key is required/i)).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("disables the submit button while pending", () => {
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    })
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)
    expect(screen.getByRole("button", { name: /save|add|submit/i })).toBeDisabled()
  })

  it("clears the API key input after successful submission", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({
      success: true as const,
      provider: "openai",
      maskedKey: "sk-pro...abcd",
    })
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled()
    })
    const input = screen.getByLabelText(/api key/i) as HTMLInputElement
    expect(input.value).toBe("")
  })

  it("does not call onSuccess when submission fails", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockRejectedValue(new Error("Network error"))
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })
})
