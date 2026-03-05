// @vitest-environment jsdom
/**
 * Task 4.15 — ResumeUploadCard component tests
 *
 * Tests FAIL before src/components/profile/resume-upload-card.tsx exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetUploadUrl, mockConfirmUpload, mockTriggerExtraction, mockFetch } = vi.hoisted(
  () => ({
    mockGetUploadUrl: vi.fn(),
    mockConfirmUpload: vi.fn(),
    mockTriggerExtraction: vi.fn(),
    mockFetch: vi.fn(),
  }),
)

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    resume: {
      getUploadUrl: { useMutation: () => ({ mutateAsync: mockGetUploadUrl, isPending: false }) },
      confirmUpload: { useMutation: () => ({ mutateAsync: mockConfirmUpload, isPending: false }) },
      triggerExtraction: {
        useMutation: () => ({ mutateAsync: mockTriggerExtraction, isPending: false }),
      },
      applyExtraction: {
        useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
      },
    },
  },
}))

vi.stubGlobal("fetch", mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePdfFile(sizeBytes = 1024) {
  return new File(["x".repeat(sizeBytes)], "resume.pdf", { type: "application/pdf" })
}

function makeDocxFile() {
  return new File(["x"], "resume.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

function makePngFile() {
  return new File(["x"], "photo.png", { type: "image/png" })
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { ResumeUploadCard } from "@/components/profile/resume-upload-card"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResumeUploadCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true })
    mockGetUploadUrl.mockResolvedValue({
      uploadUrl: "https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf",
      blobPath: "resumes/seeker_01/resume.pdf",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    mockConfirmUpload.mockResolvedValue({
      resumeUrl: "https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf",
    })
  })

  it("shows 'Upload Resume' button when no resumeUrl exists", () => {
    render(<ResumeUploadCard resumeUrl={null} hasApiKey={false} seekerId="seeker_01" />)
    expect(screen.getByRole("button", { name: /upload resume/i })).toBeInTheDocument()
  })

  it("shows the current resume filename when resumeUrl is set", () => {
    render(
      <ResumeUploadCard
        resumeUrl="https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf"
        hasApiKey={false}
        seekerId="seeker_01"
      />,
    )
    expect(screen.getByText(/resume\.pdf/i)).toBeInTheDocument()
  })

  it("rejects non-PDF/DOCX files with an error message", async () => {
    // applyAccept: false lets userEvent upload files that don't match the accept attribute,
    // which is required to test client-side MIME validation (the browser would otherwise filter)
    const user = userEvent.setup({ applyAccept: false })
    render(<ResumeUploadCard resumeUrl={null} hasApiKey={false} seekerId="seeker_01" />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, makePngFile())

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(screen.getByText(/pdf|docx/i)).toBeInTheDocument()
    expect(mockGetUploadUrl).not.toHaveBeenCalled()
  })

  it("rejects files larger than 10 MiB", async () => {
    render(<ResumeUploadCard resumeUrl={null} hasApiKey={false} seekerId="seeker_01" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(fileInput, makePdfFile(10 * 1024 * 1024 + 1))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
    expect(screen.getByText(/10 mb|10 mib|too large/i)).toBeInTheDocument()
    expect(mockGetUploadUrl).not.toHaveBeenCalled()
  })

  it("uploads PDF file and calls confirmUpload", async () => {
    render(<ResumeUploadCard resumeUrl={null} hasApiKey={false} seekerId="seeker_01" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(fileInput, makePdfFile())

    await waitFor(() => {
      expect(mockConfirmUpload).toHaveBeenCalled()
    })
  })

  it("shows 'Extract with AI' button after upload when hasApiKey is true", async () => {
    render(
      <ResumeUploadCard
        resumeUrl="https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf"
        hasApiKey={true}
        seekerId="seeker_01"
      />,
    )
    expect(screen.getByRole("button", { name: /extract with ai/i })).toBeInTheDocument()
  })

  it("shows configure-API-key prompt when hasApiKey is false and resumeUrl is set", () => {
    render(
      <ResumeUploadCard
        resumeUrl="https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf"
        hasApiKey={false}
        seekerId="seeker_01"
      />,
    )
    expect(screen.getByText(/no api key/i)).toBeInTheDocument()
  })

  it("calls triggerExtraction when Extract button is clicked", async () => {
    const user = userEvent.setup()
    mockTriggerExtraction.mockResolvedValue({
      extractionId: "clx9ab1234567890abcdefghi",
      proposed: { headline: "Engineer" },
      success: true,
    })
    render(
      <ResumeUploadCard
        resumeUrl="https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf"
        hasApiKey={true}
        seekerId="seeker_01"
      />,
    )

    await user.click(screen.getByRole("button", { name: /extract with ai/i }))

    await waitFor(() => {
      expect(mockTriggerExtraction).toHaveBeenCalledWith({
        blobUrl: "https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf",
      })
    })
  })

  it("shows error message when triggerExtraction fails", async () => {
    const user = userEvent.setup()
    mockTriggerExtraction.mockResolvedValue({
      extractionId: "",
      proposed: {},
      success: false,
      errorReason: "Invalid API key.",
    })
    render(
      <ResumeUploadCard
        resumeUrl="https://blob.vercel-storage.com/resumes/seeker_01/resume.pdf"
        hasApiKey={true}
        seekerId="seeker_01"
      />,
    )

    await user.click(screen.getByRole("button", { name: /extract with ai/i }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })
  })

  it("accepts DOCX files", async () => {
    render(<ResumeUploadCard resumeUrl={null} hasApiKey={false} seekerId="seeker_01" />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(fileInput, makeDocxFile())

    await waitFor(() => {
      expect(mockGetUploadUrl).toHaveBeenCalled()
    })
  })
})
