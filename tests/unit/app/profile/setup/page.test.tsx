// @vitest-environment jsdom
/**
 * Task 4.1 — Profile Setup page tests
 *
 * Tests FAIL before src/app/(seeker)/profile/setup/page.tsx exists.
 *
 * Test cases:
 *   1. Renders ProfileTabs and CompletenessCard when data is loaded
 *   2. Shows loading skeleton while getMe query is pending
 *   3. Passes profile data to child components
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
    jobSeekers: {
      getMe: { useQuery: mockUseQuery },
    },
  },
}))

vi.mock("@/components/profile/profile-tabs", () => ({
  ProfileTabs: ({ profile }: { profile: { name: string } }) => (
    <div data-testid="profile-tabs" data-name={profile.name} />
  ),
}))

vi.mock("@/components/profile/completeness-card", () => ({
  CompletenessCard: ({ profile }: { profile: { profileCompleteness: number } }) => (
    <div data-testid="completeness-card" data-score={profile.profileCompleteness} />
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE = {
  id: "seeker_01",
  name: "Jane Smith",
  headline: "Engineer",
  bio: null,
  resumeUrl: null,
  experience: [],
  education: [],
  skills: [],
  urls: [],
  location: null,
  relocationPreference: "NOT_OPEN",
  profileCompleteness: 30,
  isActive: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import ProfileSetupPage from "@/app/(seeker)/profile/setup/page"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProfileSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a loading skeleton while the query is pending", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<ProfileSetupPage />)
    expect(screen.getByTestId("profile-loading-skeleton")).toBeInTheDocument()
  })

  it("renders ProfileTabs when data is loaded", () => {
    mockUseQuery.mockReturnValue({ data: PROFILE, isLoading: false })
    render(<ProfileSetupPage />)
    expect(screen.getByTestId("profile-tabs")).toBeInTheDocument()
  })

  it("renders CompletenessCard when data is loaded", () => {
    mockUseQuery.mockReturnValue({ data: PROFILE, isLoading: false })
    render(<ProfileSetupPage />)
    expect(screen.getByTestId("completeness-card")).toBeInTheDocument()
  })

  it("passes profile data to ProfileTabs", () => {
    mockUseQuery.mockReturnValue({ data: PROFILE, isLoading: false })
    render(<ProfileSetupPage />)
    const tabs = screen.getByTestId("profile-tabs")
    expect(tabs).toHaveAttribute("data-name", "Jane Smith")
  })

  it("passes profile data to CompletenessCard", () => {
    mockUseQuery.mockReturnValue({ data: PROFILE, isLoading: false })
    render(<ProfileSetupPage />)
    const card = screen.getByTestId("completeness-card")
    expect(card).toHaveAttribute("data-score", "30")
  })

  it("does not render ProfileTabs or CompletenessCard while loading", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })
    render(<ProfileSetupPage />)
    expect(screen.queryByTestId("profile-tabs")).not.toBeInTheDocument()
    expect(screen.queryByTestId("completeness-card")).not.toBeInTheDocument()
  })
})
