// @vitest-environment jsdom
/**
 * Task 4.11 — UrlsForm component tests
 *
 * Tests FAIL before src/components/profile/urls-form.tsx exists.
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

const URL_ENTRY = {
  id: "clxurl1234567890abcdefghi",
  label: "GitHub",
  url: "https://github.com/jane",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { UrlsForm } from "@/components/profile/urls-form"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UrlsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders existing profile URL entries", () => {
    render(<UrlsForm urls={[URL_ENTRY]} />)
    expect(screen.getByDisplayValue("GitHub")).toBeInTheDocument()
    expect(screen.getByDisplayValue("https://github.com/jane")).toBeInTheDocument()
  })

  it("renders an 'Add URL' button", () => {
    render(<UrlsForm urls={[]} />)
    expect(screen.getByRole("button", { name: /add url/i })).toBeInTheDocument()
  })

  it("adds a new entry form when 'Add URL' is clicked", async () => {
    const user = userEvent.setup()
    render(<UrlsForm urls={[]} />)

    await user.click(screen.getByRole("button", { name: /add url/i }))

    // Should show label + url inputs
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/url/i)).toBeInTheDocument()
  })

  it("removes an entry when Remove is clicked", async () => {
    const user = userEvent.setup()
    render(<UrlsForm urls={[URL_ENTRY]} />)

    await user.click(screen.getByRole("button", { name: /remove/i }))

    expect(screen.queryByDisplayValue("GitHub")).not.toBeInTheDocument()
  })

  it("disables 'Add URL' when 10 URLs are present", () => {
    const tenUrls = Array.from({ length: 10 }, (_, i) => ({
      id: `clxurl${i}234567890abcdefghi`,
      label: `Link ${i}`,
      url: `https://example.com/${i}`,
    }))
    render(<UrlsForm urls={tenUrls} />)

    expect(screen.getByRole("button", { name: /add url/i })).toBeDisabled()
  })

  it("shows inline error for invalid URL format on save", async () => {
    const user = userEvent.setup()
    const invalidEntry = { ...URL_ENTRY, url: "not-a-url" }
    render(<UrlsForm urls={[invalidEntry]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it("submits complete urls array with the 'urls' key on save", async () => {
    const user = userEvent.setup()
    mockMutateAsync.mockResolvedValue({ urls: [URL_ENTRY], profileCompleteness: 15 })
    render(<UrlsForm urls={[URL_ENTRY]} />)

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          urls: expect.arrayContaining([
            expect.objectContaining({ url: "https://github.com/jane" }),
          ]),
        }),
      )
    })
  })
})
