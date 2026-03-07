// @vitest-environment happy-dom
/**
 * Task 5.3 — New posting page tests
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/components/employer/job-posting-form", () => ({
  JobPostingForm: ({ posting }: { posting: unknown }) => (
    <div data-testid="job-posting-form" data-is-new={posting === null ? "true" : "false"} />
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

import NewPostingPage from "@/app/(employer)/postings/new/page"

describe("NewPostingPage", () => {
  it("renders empty JobPostingForm", () => {
    render(<NewPostingPage />)
    const form = screen.getByTestId("job-posting-form")
    expect(form).toBeInTheDocument()
    expect(form).toHaveAttribute("data-is-new", "true")
  })

  it("renders page heading", () => {
    render(<NewPostingPage />)
    expect(screen.getByText(/new job posting/i)).toBeInTheDocument()
  })
})
