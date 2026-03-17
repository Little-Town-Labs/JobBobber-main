// @vitest-environment happy-dom
/**
 * Task 4.3 — Employer Dashboard page tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockUseQueryEmployer, mockUseQueryPostings } = vi.hoisted(() => ({
  mockUseQueryEmployer: vi.fn(),
  mockUseQueryPostings: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    employers: {
      getMe: { useQuery: mockUseQueryEmployer },
    },
    jobPostings: {
      listMine: { useQuery: mockUseQueryPostings },
    },
    dashboard: {
      getPipelineSummary: {
        useQuery: () => ({ data: undefined, isLoading: false }),
      },
    },
  },
}))

vi.mock("@/lib/trpc/hooks", () => ({
  useHiringMetricsIsEnabled: () => ({ data: false, isLoading: false }),
  useDashboardGetPipelineSummary: () => ({ data: undefined, isLoading: false }),
}))

vi.mock("@/components/employer/company-profile-card", () => ({
  CompanyProfileCard: ({ employer }: { employer: { name: string } }) => (
    <div data-testid="company-profile-card" data-name={employer.name} />
  ),
}))

vi.mock("@/components/employer/job-posting-list", () => ({
  JobPostingList: ({ postings }: { postings: unknown[] }) => (
    <div data-testid="job-posting-list" data-count={postings.length} />
  ),
}))

vi.mock("@/components/insights/insights-panel", () => ({
  InsightsPanel: () => <div data-testid="insights-panel" />,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYER = {
  id: "emp_01",
  name: "Acme Corp",
  description: "We build things.",
  industry: "Technology",
  size: "51-200",
  culture: null,
  headquarters: "San Francisco, CA",
  locations: [],
  websiteUrl: null,
  urls: {},
  benefits: [],
  logoUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

const POSTINGS = {
  items: [
    {
      id: "post_01",
      employerId: "emp_01",
      title: "Software Engineer",
      status: "DRAFT",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  nextCursor: null,
  hasMore: false,
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import EmployerDashboardPage from "@/app/(employer)/dashboard/page"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EmployerDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading skeleton while data is pending", () => {
    mockUseQueryEmployer.mockReturnValue({ data: undefined, isLoading: true })
    mockUseQueryPostings.mockReturnValue({ data: undefined, isLoading: true })
    render(<EmployerDashboardPage />)
    expect(screen.getByTestId("employer-loading-skeleton")).toBeInTheDocument()
  })

  it("renders company profile card when data is loaded", () => {
    mockUseQueryEmployer.mockReturnValue({ data: EMPLOYER, isLoading: false })
    mockUseQueryPostings.mockReturnValue({ data: POSTINGS, isLoading: false })
    render(<EmployerDashboardPage />)
    expect(screen.getByTestId("company-profile-card")).toBeInTheDocument()
  })

  it("renders job posting list when data is loaded", () => {
    mockUseQueryEmployer.mockReturnValue({ data: EMPLOYER, isLoading: false })
    mockUseQueryPostings.mockReturnValue({ data: POSTINGS, isLoading: false })
    render(<EmployerDashboardPage />)
    expect(screen.getByTestId("job-posting-list")).toBeInTheDocument()
  })

  it("passes employer data to CompanyProfileCard", () => {
    mockUseQueryEmployer.mockReturnValue({ data: EMPLOYER, isLoading: false })
    mockUseQueryPostings.mockReturnValue({ data: POSTINGS, isLoading: false })
    render(<EmployerDashboardPage />)
    const card = screen.getByTestId("company-profile-card")
    expect(card).toHaveAttribute("data-name", "Acme Corp")
  })

  it("shows empty state when no postings exist", () => {
    mockUseQueryEmployer.mockReturnValue({ data: EMPLOYER, isLoading: false })
    mockUseQueryPostings.mockReturnValue({
      data: { items: [], nextCursor: null, hasMore: false },
      isLoading: false,
    })
    render(<EmployerDashboardPage />)
    expect(screen.getByTestId("job-posting-list")).toHaveAttribute("data-count", "0")
  })
})
