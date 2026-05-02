// @vitest-environment happy-dom
/**
 * T4.1 — RoleSelectorForm component tests
 *
 * Tests user interactions with the role selection form:
 * - Radio button selection (JOB_SEEKER / EMPLOYER)
 * - Conditional company name field for EMPLOYER
 * - Form submission → fetch POST to /api/trpc/onboarding.setRole
 * - Redirect on success
 * - Error display on failure
 * - Disabled state during pending mutation
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

import { RoleSelectorForm } from "@/components/onboarding/role-selector"

function makeFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response)
}

describe("RoleSelectorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
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

  it("submits JOB_SEEKER role and calls fetch with correct body", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockReturnValue(
      makeFetchResponse({ result: { data: { json: { redirectTo: "/setup/api-key" } } } }),
    )
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/job seeker/i))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/trpc/onboarding.setRole",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("JOB_SEEKER"),
        }),
      )
    })
  })

  it("submits EMPLOYER role with company name in body", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockReturnValue(
      makeFetchResponse({ result: { data: { json: { redirectTo: "/setup/api-key" } } } }),
    )
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/employer/i))
    await user.type(screen.getByLabelText(/company name/i), "Acme Corp")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/trpc/onboarding.setRole",
        expect.objectContaining({
          body: expect.stringContaining("Acme Corp"),
        }),
      )
    })
  })

  it("redirects to the path returned by the server", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockReturnValue(
      makeFetchResponse({ result: { data: { json: { redirectTo: "/setup/api-key" } } } }),
    )
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/job seeker/i))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/setup/api-key")
    })
  })

  it("displays an error alert when the fetch fails", async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockRejectedValue(new Error("Failed to create account"))
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
    expect(fetch).not.toHaveBeenCalled()
  })

  it("disables the submit button while the fetch is pending", async () => {
    // fetch never resolves — button stays disabled
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}))
    const user = userEvent.setup()
    render(<RoleSelectorForm />)

    await user.click(screen.getByLabelText(/job seeker/i))
    await user.click(screen.getByRole("button", { name: /continue/i }))

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled()
  })
})
