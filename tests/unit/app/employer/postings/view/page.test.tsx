// @vitest-environment jsdom
/**
 * Task 5.3 — View posting page tests
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

vi.mock("@/components/employer/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}))

vi.mock("@/components/employer/status-controls", () => ({
  StatusControls: () => <div data-testid="status-controls" />,
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
  responsibilities: "Write code",
  requiredSkills: ["TypeScript", "React"],
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

import ViewPostingPage from "@/app/(employer)/postings/[id]/page"

describe("ViewPostingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading state while pending", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<ViewPostingPage />)
    expect(screen.getByTestId("posting-loading-skeleton")).toBeInTheDocument()
  })

  it("renders posting title when loaded", () => {
    mockUseQuery.mockReturnValue({ data: POSTING, isLoading: false })
    render(<ViewPostingPage />)
    expect(screen.getByText("Software Engineer")).toBeInTheDocument()
  })

  it("renders status badge", () => {
    mockUseQuery.mockReturnValue({ data: POSTING, isLoading: false })
    render(<ViewPostingPage />)
    expect(screen.getByTestId("status-badge")).toBeInTheDocument()
  })

  it("renders status controls", () => {
    mockUseQuery.mockReturnValue({ data: POSTING, isLoading: false })
    render(<ViewPostingPage />)
    expect(screen.getByTestId("status-controls")).toBeInTheDocument()
  })

  it("shows edit link", () => {
    mockUseQuery.mockReturnValue({ data: POSTING, isLoading: false })
    render(<ViewPostingPage />)
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument()
  })
})
