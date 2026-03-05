// @vitest-environment jsdom
/**
 * Task 4.1 — CompletenessCard component tests
 *
 * Tests FAIL before src/components/profile/completeness-card.tsx exists.
 *
 * Test cases:
 *   1. Shows numeric score (e.g., "45%")
 *   2. Shows progress bar with correct fill
 *   3. At score >= 70: shows "Agent activation available"
 *   4. At score < 70: shows "X more points needed"
 *   5. Lists incomplete sections with correct point values
 *   6. Incomplete sections are clickable links to their tab
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INCOMPLETE_PROFILE = {
  name: "Jane",
  headline: null,
  bio: null,
  resumeUrl: null,
  experience: [],
  education: [],
  skills: [],
  location: null,
  profileCompleteness: 15, // name only
}

const ACTIVE_PROFILE = {
  name: "Jane",
  headline: "Engineer",
  bio: "Some bio text",
  resumeUrl: "https://blob.vercel-storage.com/resume.pdf",
  experience: [
    {
      id: "exp1",
      jobTitle: "Dev",
      company: "Co",
      startDate: "2020-01-01",
      endDate: null,
      description: "",
    },
  ],
  education: [
    {
      id: "edu1",
      institution: "Uni",
      degree: "BS",
      fieldOfStudy: "CS",
      startDate: "2016-01-01",
      endDate: "2020-01-01",
      description: "",
    },
  ],
  skills: ["TypeScript", "React", "Node.js"],
  location: "Austin, TX",
  profileCompleteness: 100,
}

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------

import { CompletenessCard } from "@/components/profile/completeness-card"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompletenessCard", () => {
  it("displays the numeric completeness score", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    expect(screen.getByText(/15%/)).toBeInTheDocument()
  })

  it("renders a progress bar element", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    const progressBar = screen.getByRole("progressbar")
    expect(progressBar).toBeInTheDocument()
  })

  it("progress bar has correct aria-valuenow", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    const progressBar = screen.getByRole("progressbar")
    expect(progressBar).toHaveAttribute("aria-valuenow", "15")
  })

  it("shows 'Agent activation available' when score >= 70", () => {
    const profile = { ...INCOMPLETE_PROFILE, profileCompleteness: 70 }
    render(<CompletenessCard profile={profile} />)
    expect(screen.getByText(/agent activation available/i)).toBeInTheDocument()
  })

  it("shows 'X more points needed' when score < 70", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    expect(screen.getByText(/55 more points needed/i)).toBeInTheDocument()
  })

  it("shows 0 points needed at exactly 70", () => {
    const profile = { ...INCOMPLETE_PROFILE, profileCompleteness: 70 }
    render(<CompletenessCard profile={profile} />)
    // Should show "Agent activation available" not "points needed"
    expect(screen.queryByText(/points needed/i)).not.toBeInTheDocument()
  })

  it("lists incomplete sections when score < 100", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    // headline (15 pts), bio (10 pts), experience (20 pts),
    // skills (15 pts), education (10 pts), resumeUrl (10 pts), location (5 pts) are missing
    expect(screen.getByText(/headline/i)).toBeInTheDocument()
    expect(screen.getByText(/experience/i)).toBeInTheDocument()
  })

  it("shows point values for incomplete sections", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    // Experience = 20 pts
    expect(screen.getByText(/20 pts/i)).toBeInTheDocument()
  })

  it("does not list sections that are complete", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    // name is present so it should not appear as incomplete
    expect(screen.queryByText(/name.*15 pts/i)).not.toBeInTheDocument()
  })

  it("shows score 100 when all sections complete", () => {
    render(<CompletenessCard profile={ACTIVE_PROFILE} />)
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.getByText(/agent activation available/i)).toBeInTheDocument()
  })

  it("incomplete sections are links to corresponding tabs", () => {
    render(<CompletenessCard profile={INCOMPLETE_PROFILE} />)
    // Experience section should link to ?tab=experience
    const expLinks = screen.getAllByRole("link")
    const expLink = expLinks.find((l) => l.getAttribute("href")?.includes("experience"))
    expect(expLink).toBeInTheDocument()
  })
})
