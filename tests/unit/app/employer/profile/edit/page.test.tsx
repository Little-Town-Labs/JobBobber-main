// @vitest-environment happy-dom
/**
 * Task 4.3 — Employer Profile Edit page tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}))

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    employers: {
      getMe: { useQuery: mockUseQuery },
    },
  },
}))

vi.mock("@/components/employer/company-profile-form", () => ({
  CompanyProfileForm: ({ employer }: { employer: { name: string } }) => (
    <div data-testid="company-profile-form" data-name={employer.name} />
  ),
}))

vi.mock("@/components/employer/logo-upload", () => ({
  LogoUpload: ({ currentLogoUrl }: { currentLogoUrl: string | null }) => (
    <div data-testid="logo-upload" data-url={currentLogoUrl ?? ""} />
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
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
  logoUrl: "https://blob.example.com/logo.png",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import EmployerProfileEditPage from "@/app/(employer)/profile/edit/page"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EmployerProfileEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading state while query is pending", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<EmployerProfileEditPage />)
    expect(screen.getByTestId("employer-loading-skeleton")).toBeInTheDocument()
  })

  it("renders company profile form when data is loaded", () => {
    mockUseQuery.mockReturnValue({ data: EMPLOYER, isLoading: false })
    render(<EmployerProfileEditPage />)
    expect(screen.getByTestId("company-profile-form")).toBeInTheDocument()
  })

  it("renders logo upload when data is loaded", () => {
    mockUseQuery.mockReturnValue({ data: EMPLOYER, isLoading: false })
    render(<EmployerProfileEditPage />)
    expect(screen.getByTestId("logo-upload")).toBeInTheDocument()
  })

  it("passes employer data to form", () => {
    mockUseQuery.mockReturnValue({ data: EMPLOYER, isLoading: false })
    render(<EmployerProfileEditPage />)
    expect(screen.getByTestId("company-profile-form")).toHaveAttribute("data-name", "Acme Corp")
  })

  it("passes logoUrl to LogoUpload", () => {
    mockUseQuery.mockReturnValue({ data: EMPLOYER, isLoading: false })
    render(<EmployerProfileEditPage />)
    expect(screen.getByTestId("logo-upload")).toHaveAttribute(
      "data-url",
      "https://blob.example.com/logo.png",
    )
  })
})
