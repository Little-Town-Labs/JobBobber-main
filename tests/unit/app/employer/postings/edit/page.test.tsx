// @vitest-environment jsdom
/**
 * Task 5.3 — Edit posting page tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    jobPostings: {
      getById: { useQuery: mockUseQuery },
    },
  },
}))

vi.mock("@/components/employer/job-posting-form", () => ({
  JobPostingForm: ({ posting }: { posting: { title: string } | null }) => (
    <div data-testid="job-posting-form" data-title={posting?.title ?? ""} />
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: "post_01" }),
}))

const POSTING = {
  id: "post_01",
  employerId: "emp_01",
  title: "Software Engineer",
  department: "Engineering",
  description: "Build great software.",
  responsibilities: null,
  requiredSkills: ["TypeScript"],
  preferredSkills: [],
  experienceLevel: "MID",
  employmentType: "FULL_TIME",
  locationType: "REMOTE",
  locationReq: null,
  salaryMin: 80000,
  salaryMax: 120000,
  benefits: [],
  whyApply: null,
  status: "DRAFT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

import EditPostingPage from "@/app/(employer)/postings/[id]/edit/page"

describe("EditPostingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading state while pending", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<EditPostingPage />)
    expect(screen.getByTestId("posting-loading-skeleton")).toBeInTheDocument()
  })

  it("renders form pre-filled with existing data", () => {
    mockUseQuery.mockReturnValue({ data: POSTING, isLoading: false })
    render(<EditPostingPage />)
    const form = screen.getByTestId("job-posting-form")
    expect(form).toHaveAttribute("data-title", "Software Engineer")
  })

  it("renders page heading", () => {
    mockUseQuery.mockReturnValue({ data: POSTING, isLoading: false })
    render(<EditPostingPage />)
    expect(screen.getByText(/edit/i)).toBeInTheDocument()
  })
})
