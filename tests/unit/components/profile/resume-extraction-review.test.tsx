// @vitest-environment jsdom
/**
 * Task 4.15 — ResumeExtractionReview component tests
 *
 * Tests FAIL before src/components/profile/resume-extraction-review.tsx exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockApplyExtraction, mockIsPending } = vi.hoisted(() => ({
  mockApplyExtraction: vi.fn(),
  mockIsPending: { value: false },
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    resume: {
      applyExtraction: {
        useMutation: () => ({ mutateAsync: mockApplyExtraction, isPending: mockIsPending.value }),
      },
    },
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXTRACTION_ID = "clx9ab1234567890abcdefghi"

const PROPOSED = {
  headline: "Senior Software Engineer",
  experience: [{ jobTitle: "Engineer", company: "Co", startDate: "2020-01-01" }],
  education: [{ institution: "Uni", degree: "BS", fieldOfStudy: "CS", startDate: "2016-01-01" }],
  skills: ["TypeScript", "React", "Go"],
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { ResumeExtractionReview } from "@/components/profile/resume-extraction-review"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResumeExtractionReview", () => {
  const mockOnApplied = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPending.value = false
  })

  it("renders the proposed headline", () => {
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )
    expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument()
  })

  it("renders proposed experience, education, and skills sections", () => {
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )
    expect(screen.getByText(/experience/i)).toBeInTheDocument()
    expect(screen.getByText(/education/i)).toBeInTheDocument()
    expect(screen.getByText(/^skills$/i)).toBeInTheDocument()
  })

  it("has an 'Apply this section' checkbox for each section", () => {
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes.length).toBeGreaterThanOrEqual(4) // headline, experience, education, skills
  })

  it("'Apply All' button checks all section checkboxes", async () => {
    const user = userEvent.setup()
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )

    await user.click(screen.getByRole("button", { name: /apply all/i }))

    const checkboxes = screen.getAllByRole("checkbox")
    checkboxes.forEach((cb) => {
      // The mergeSkills toggle is also a checkbox — at minimum all section apply checkboxes are checked
      if ((cb as HTMLInputElement).name !== "mergeSkills") {
        expect(cb).toBeChecked()
      }
    })
  })

  it("has a mergeSkills toggle defaulting to true (merge)", () => {
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )
    const mergeToggle = screen.getByLabelText(/merge skills/i)
    expect(mergeToggle).toBeChecked()
  })

  it("calls applyExtraction with correct flags on submit", async () => {
    const user = userEvent.setup()
    mockApplyExtraction.mockResolvedValue({ id: "seeker_01", profileCompleteness: 85 })
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )

    // Check headline
    await user.click(screen.getByLabelText(/apply headline/i))
    await user.click(screen.getByRole("button", { name: /apply selected/i }))

    await waitFor(() => {
      expect(mockApplyExtraction).toHaveBeenCalledWith(
        expect.objectContaining({
          extractionId: EXTRACTION_ID,
          applyHeadline: true,
        }),
      )
    })
  })

  it("shows loading state during applyExtraction", () => {
    mockIsPending.value = true
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )
    // The submit button should be disabled when pending
    expect(screen.getByRole("button", { name: /apply selected/i })).toBeDisabled()
  })

  it("calls onApplied after successful application", async () => {
    const user = userEvent.setup()
    const updatedProfile = { id: "seeker_01", profileCompleteness: 85 }
    mockApplyExtraction.mockResolvedValue(updatedProfile)
    render(
      <ResumeExtractionReview
        extractionId={EXTRACTION_ID}
        proposed={PROPOSED}
        onApplied={mockOnApplied}
        onClose={mockOnClose}
      />,
    )

    await user.click(screen.getByRole("button", { name: /apply selected/i }))

    await waitFor(() => {
      expect(mockOnApplied).toHaveBeenCalledWith(updatedProfile)
    })
  })
})
