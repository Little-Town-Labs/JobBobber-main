// @vitest-environment jsdom
/**
 * Task 4.1 — LogoUpload component tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
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
      updateLogo: { useMutation: mockUseMutation },
    },
  },
}))

vi.mock("@vercel/blob/client", () => ({
  upload: vi.fn().mockResolvedValue({ url: "https://blob.example.com/new-logo.png" }),
}))

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { LogoUpload } from "@/components/employer/logo-upload"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LogoUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
  })

  it("renders file input", () => {
    render(<LogoUpload currentLogoUrl={null} />)
    expect(screen.getByLabelText(/logo/i)).toBeInTheDocument()
  })

  it("shows current logo preview when logoUrl is present", () => {
    render(<LogoUpload currentLogoUrl="https://blob.example.com/logo.png" />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "https://blob.example.com/logo.png")
  })

  it("shows no preview when logoUrl is null", () => {
    render(<LogoUpload currentLogoUrl={null} />)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("rejects non-image file types client-side", async () => {
    render(<LogoUpload currentLogoUrl={null} />)
    const input = screen.getByLabelText(/logo/i)

    const file = new File(["content"], "doc.pdf", { type: "application/pdf" })
    // Use fireEvent to bypass the accept attribute filter (userEvent respects it)
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("rejects files exceeding 2 MB", async () => {
    const user = userEvent.setup()
    render(<LogoUpload currentLogoUrl={null} />)
    const input = screen.getByLabelText(/logo/i)

    const largeContent = new Uint8Array(2 * 1024 * 1024 + 1)
    const file = new File([largeContent], "big.png", { type: "image/png" })
    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("shows preview after selecting a valid file", async () => {
    const user = userEvent.setup()
    render(<LogoUpload currentLogoUrl={null} />)
    const input = screen.getByLabelText(/logo/i)

    const file = new File(["img"], "logo.png", { type: "image/png" })
    await user.upload(input, file)

    await waitFor(() => {
      expect(screen.getByRole("img")).toBeInTheDocument()
    })
  })
})
