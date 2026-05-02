// @vitest-environment happy-dom
/**
 * T4.3 — ByokSetupForm component tests
 *
 * Tests the API key submission form used during onboarding (/setup/api-key)
 * and from the ApiKeyManager when adding/changing a key:
 * - Provider selection (openai / anthropic)
 * - API key input
 * - Form submission → fetch POST to /api/trpc/byok.storeKey
 * - Success callback invocation
 * - Error display on failure
 * - Loading state during submission
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ByokSetupForm } from "@/components/onboarding/api-key-form"

function makeFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response)
}

describe("ByokSetupForm", () => {
  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
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
    const result = { success: true, provider: "openai", maskedKey: "sk-pro...abcd" }
    vi.mocked(fetch).mockReturnValue(makeFetchResponse({ result: { data: { json: result } } }))
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/trpc/byok.storeKey",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("sk-proj-testkey123"),
        }),
      )
    })
  })

  it("calls onSuccess callback with result after successful submission", async () => {
    const user = userEvent.setup()
    const result = { success: true as const, provider: "openai", maskedKey: "sk-pro...abcd" }
    vi.mocked(fetch).mockReturnValue(makeFetchResponse({ result: { data: { json: result } } }))
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(result)
    })
  })

  it("displays an error alert when the fetch fails with a network error", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"))
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-invalid")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("displays an error alert when the server returns an error", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockReturnValue(
      makeFetchResponse({ error: { message: "Invalid API key" } }, false),
    )
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
    expect(fetch).not.toHaveBeenCalled()
  })

  it("disables the submit button while pending", async () => {
    // Use a promise that doesn't resolve to keep isPending = true
    let resolveFetch!: (v: Response) => void
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )
    const user = userEvent.setup()
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    expect(screen.getByRole("button", { name: /save|add|submit/i })).toBeDisabled()

    // Cleanup — resolve the hanging promise
    resolveFetch({ ok: true, json: async () => ({ result: { data: { json: null } } }) } as Response)
  })

  it("clears the API key input after successful submission", async () => {
    const user = userEvent.setup()
    const result = { success: true as const, provider: "openai", maskedKey: "sk-pro...abcd" }
    vi.mocked(fetch).mockReturnValue(makeFetchResponse({ result: { data: { json: result } } }))
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
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"))
    render(<ByokSetupForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByLabelText(/api key/i), "sk-proj-testkey123")
    await user.click(screen.getByRole("button", { name: /save|add|submit/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })
})
