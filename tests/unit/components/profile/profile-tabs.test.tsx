// @vitest-environment jsdom
/**
 * Task 4.1 — ProfileTabs component tests
 *
 * Tests FAIL before src/components/profile/profile-tabs.tsx exists.
 *
 * Test cases:
 *   1. Renders all 6 tabs (Basic Info, Experience, Education, Skills, URLs, Location)
 *   2. Active tab defaults to 'basic' when no ?tab param
 *   3. Active tab matches ?tab=experience search param
 *   4. Clicking a tab updates the URL search param
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockReplace, mockSearchParams } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockSearchParams: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: mockSearchParams,
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE = {
  id: "seeker_01",
  name: "Jane Smith",
  headline: null,
  bio: null,
  resumeUrl: null,
  experience: [],
  education: [],
  skills: [],
  urls: [],
  location: null,
  relocationPreference: "NOT_OPEN",
  profileCompleteness: 15,
  isActive: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

function makeSearchParams(tab?: string) {
  return {
    get: (key: string) => (key === "tab" && tab ? tab : null),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { ProfileTabs } from "@/components/profile/profile-tabs"

describe("ProfileTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders all 6 tab labels", () => {
    mockSearchParams.mockReturnValue(makeSearchParams())
    render(<ProfileTabs profile={PROFILE} />)

    expect(screen.getByRole("tab", { name: /basic info/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /experience/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /education/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /skills/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /urls/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /location/i })).toBeInTheDocument()
  })

  it("defaults to basic tab when no search param", () => {
    mockSearchParams.mockReturnValue(makeSearchParams())
    render(<ProfileTabs profile={PROFILE} />)

    const basicTab = screen.getByRole("tab", { name: /basic info/i })
    expect(basicTab).toHaveAttribute("aria-selected", "true")
  })

  it("activates the tab matching the ?tab search param", () => {
    mockSearchParams.mockReturnValue(makeSearchParams("experience"))
    render(<ProfileTabs profile={PROFILE} />)

    const expTab = screen.getByRole("tab", { name: /experience/i })
    expect(expTab).toHaveAttribute("aria-selected", "true")

    const basicTab = screen.getByRole("tab", { name: /basic info/i })
    expect(basicTab).toHaveAttribute("aria-selected", "false")
  })

  it("calls router.replace with new tab param when a tab is clicked", async () => {
    const user = userEvent.setup()
    mockSearchParams.mockReturnValue(makeSearchParams())
    render(<ProfileTabs profile={PROFILE} />)

    await user.click(screen.getByRole("tab", { name: /experience/i }))

    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("tab=experience"))
  })

  it("shows a tab panel for the active tab", () => {
    mockSearchParams.mockReturnValue(makeSearchParams("skills"))
    render(<ProfileTabs profile={PROFILE} />)

    expect(screen.getByRole("tabpanel")).toBeInTheDocument()
  })
})
