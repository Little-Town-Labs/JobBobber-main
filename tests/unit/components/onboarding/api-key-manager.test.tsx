// @vitest-environment happy-dom
/**
 * T4.5 — ApiKeyManager component tests
 *
 * Tests the API key management widget shown on the account settings page:
 * - Shows loading state while fetching key status
 * - Shows "no key configured" when hasKey is false
 * - Shows masked key + provider when hasKey is true
 * - Delete button calls fetch POST to /api/trpc/byok.deleteKey
 * - Shows add-key form when no key exists
 * - Shows change-key form when key exists and user requests change
 * - Hides form after successful key save
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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

import { ApiKeyManager } from "@/components/onboarding/api-key-manager"

function makeFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response)
}

function makeStatusResponse(data: unknown) {
  return makeFetchResponse({ result: { data: { json: data } } })
}

describe("ApiKeyManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  it("shows a loading indicator while fetching key status", () => {
    // fetch never resolves — component stays in loading state
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}))
    render(<ApiKeyManager />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it("shows 'no key configured' when no key is stored", async () => {
    vi.mocked(fetch).mockReturnValue(
      makeStatusResponse({ hasKey: false, provider: null, maskedKey: null }),
    )
    render(<ApiKeyManager />)
    await waitFor(() => {
      expect(screen.getByText(/no api key configured/i)).toBeInTheDocument()
    })
  })

  it("shows masked key and provider when a key is stored", async () => {
    vi.mocked(fetch).mockReturnValue(
      makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
    )
    render(<ApiKeyManager />)
    await waitFor(() => {
      expect(screen.getByText(/sk-pro...abcd/)).toBeInTheDocument()
      expect(screen.getByText(/openai/i)).toBeInTheDocument()
    })
  })

  it("shows a delete button when a key is stored", async () => {
    vi.mocked(fetch).mockReturnValue(
      makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
    )
    render(<ApiKeyManager />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
    })
  })

  it("calls deleteKey endpoint when delete button is clicked", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockReturnValueOnce(
        makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
      )
      .mockReturnValueOnce(makeFetchResponse({ result: { data: { json: { success: true } } } }))
      .mockReturnValueOnce(makeStatusResponse({ hasKey: false }))

    render(<ApiKeyManager />)
    await waitFor(() => screen.getByRole("button", { name: /delete/i }))

    await user.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/trpc/byok.deleteKey",
        expect.objectContaining({ method: "POST" }),
      )
    })
  })

  it("shows add-key form when no key is configured", async () => {
    vi.mocked(fetch).mockReturnValue(
      makeStatusResponse({ hasKey: false, provider: null, maskedKey: null }),
    )
    render(<ApiKeyManager />)
    await waitFor(() => {
      expect(screen.getByTestId("byok-setup-form")).toBeInTheDocument()
    })
  })

  it("hides the add-key form when a key is already stored", async () => {
    vi.mocked(fetch).mockReturnValue(
      makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
    )
    render(<ApiKeyManager />)
    await waitFor(() => screen.getByText(/sk-pro...abcd/))
    expect(screen.queryByTestId("byok-setup-form")).not.toBeInTheDocument()
  })

  it("shows change-key form when user clicks the change button", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockReturnValue(
      makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
    )
    render(<ApiKeyManager />)
    await waitFor(() => screen.getByRole("button", { name: /change/i }))

    await user.click(screen.getByRole("button", { name: /change/i }))
    expect(screen.getByTestId("byok-setup-form")).toBeInTheDocument()
  })

  it("hides change-key form after successful key save", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockReturnValueOnce(
        makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
      )
      .mockReturnValueOnce(
        makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...wxyz" }),
      )

    render(<ApiKeyManager />)
    await waitFor(() => screen.getByRole("button", { name: /change/i }))

    // Open the change form
    await user.click(screen.getByRole("button", { name: /change/i }))
    expect(screen.getByTestId("byok-setup-form")).toBeInTheDocument()

    // Submit the mocked form (triggers onSuccess)
    await user.click(screen.getByRole("button", { name: /submit form/i }))

    await waitFor(() => {
      expect(screen.queryByTestId("byok-setup-form")).not.toBeInTheDocument()
    })
  })

  it("shows error alert when delete endpoint returns an error", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockReturnValueOnce(
        makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
      )
      .mockReturnValueOnce(makeFetchResponse({ error: { message: "Network error" } }, false))

    render(<ApiKeyManager />)
    await waitFor(() => screen.getByRole("button", { name: /delete/i }))

    await user.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("shows error message when key status query fails", async () => {
    vi.mocked(fetch).mockReturnValue(makeFetchResponse({ error: { message: "Failed" } }, false))
    render(<ApiKeyManager />)
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("refetches key status after deleting key", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockReturnValueOnce(
        makeStatusResponse({ hasKey: true, provider: "openai", maskedKey: "sk-pro...abcd" }),
      )
      .mockReturnValueOnce(makeFetchResponse({ result: { data: { json: { success: true } } } }))
      .mockReturnValueOnce(makeStatusResponse({ hasKey: false }))

    render(<ApiKeyManager />)
    await waitFor(() => screen.getByRole("button", { name: /delete/i }))

    await user.click(screen.getByRole("button", { name: /delete/i }))

    await waitFor(() => {
      // fetch called 3 times: initial status, delete, refetch status
      expect(fetch).toHaveBeenCalledTimes(3)
    })
  })
})
