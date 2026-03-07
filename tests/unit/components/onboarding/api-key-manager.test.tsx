// @vitest-environment happy-dom
/**
 * T4.5 — ApiKeyManager component tests
 *
 * Tests the API key management widget shown on the account settings page:
 * - Shows loading state while querying key status
 * - Shows "no key configured" when hasKey is false
 * - Shows masked key + provider when hasKey is true
 * - Delete button calls trpc.byok.deleteKey mutation
 * - Shows add-key form when no key exists
 * - Shows change-key form when key exists and user requests change
 * - Hides form after successful key save
 *
 * Tests must FAIL before the component exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockUseQuery, mockUseDeleteMutation, mockDeleteMutateAsync } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseDeleteMutation: vi.fn(),
  mockDeleteMutateAsync: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    byok: {
      getKeyStatus: {
        useQuery: mockUseQuery,
      },
      deleteKey: {
        useMutation: mockUseDeleteMutation,
      },
    },
  },
}))

// ByokSetupForm is rendered inside ApiKeyManager — mock it to isolate tests
vi.mock("@/components/onboarding/api-key-form", () => ({
  ByokSetupForm: ({ onSuccess }: { onSuccess: (r: unknown) => void }) => (
    <form
      data-testid="byok-setup-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSuccess({ success: true, provider: "openai", maskedKey: "sk-pro...abcd" })
      }}
    >
      <button type="submit">Submit Form</button>
    </form>
  ),
}))

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { ApiKeyManager } from "@/components/onboarding/api-key-manager"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryResult(
  override: Partial<{ data: unknown; isLoading: boolean; refetch: () => void }> = {},
) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...override,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ApiKeyManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDeleteMutation.mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    })
  })

  it("shows a loading indicator while fetching key status", () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ isLoading: true }))
    render(<ApiKeyManager />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it("shows 'no key configured' when no key is stored", () => {
    mockUseQuery.mockReturnValue(
      makeQueryResult({ data: { hasKey: false, provider: null, maskedKey: null } }),
    )
    render(<ApiKeyManager />)
    expect(screen.getByText(/no api key configured/i)).toBeInTheDocument()
  })

  it("shows masked key and provider when a key is stored", () => {
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
      }),
    )
    render(<ApiKeyManager />)
    expect(screen.getByText(/sk-pro...abcd/)).toBeInTheDocument()
    expect(screen.getByText(/openai/i)).toBeInTheDocument()
  })

  it("shows a delete button when a key is stored", () => {
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
      }),
    )
    render(<ApiKeyManager />)
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })

  it("calls deleteKey mutation when delete button is clicked", async () => {
    const user = userEvent.setup()
    const mockRefetch = vi.fn()
    mockDeleteMutateAsync.mockResolvedValue({ success: true })
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
        refetch: mockRefetch,
      }),
    )
    render(<ApiKeyManager />)

    await user.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalled()
    })
  })

  it("shows add-key form when no key is configured", () => {
    mockUseQuery.mockReturnValue(
      makeQueryResult({ data: { hasKey: false, provider: null, maskedKey: null } }),
    )
    render(<ApiKeyManager />)
    expect(screen.getByTestId("byok-setup-form")).toBeInTheDocument()
  })

  it("hides the add-key form when a key is already stored", () => {
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
      }),
    )
    render(<ApiKeyManager />)
    expect(screen.queryByTestId("byok-setup-form")).not.toBeInTheDocument()
  })

  it("shows change-key form when user clicks the change button", async () => {
    const user = userEvent.setup()
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
      }),
    )
    render(<ApiKeyManager />)

    await user.click(screen.getByRole("button", { name: /change/i }))
    expect(screen.getByTestId("byok-setup-form")).toBeInTheDocument()
  })

  it("hides change-key form after successful key save", async () => {
    const user = userEvent.setup()
    const mockRefetch = vi.fn()
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
        refetch: mockRefetch,
      }),
    )
    render(<ApiKeyManager />)

    // Open the change form
    await user.click(screen.getByRole("button", { name: /change/i }))
    expect(screen.getByTestId("byok-setup-form")).toBeInTheDocument()

    // Submit the mocked form (triggers onSuccess)
    await user.click(screen.getByRole("button", { name: /submit form/i }))

    await waitFor(() => {
      expect(screen.queryByTestId("byok-setup-form")).not.toBeInTheDocument()
    })
  })

  it("shows error alert when delete mutation fails", async () => {
    const user = userEvent.setup()
    mockDeleteMutateAsync.mockRejectedValue(new Error("Network error"))
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
      }),
    )
    render(<ApiKeyManager />)

    await user.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("shows error message when key status query fails", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    })
    render(<ApiKeyManager />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("refetches key status after deleting key", async () => {
    const user = userEvent.setup()
    const mockRefetch = vi.fn()
    mockDeleteMutateAsync.mockResolvedValue({ success: true })
    mockUseQuery.mockReturnValue(
      makeQueryResult({
        data: { hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" },
        refetch: mockRefetch,
      }),
    )
    render(<ApiKeyManager />)

    await user.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})
