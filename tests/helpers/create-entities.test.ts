/**
 * Task 1.3: Entity & Context Factories — Tests (TDD RED phase)
 *
 * Tests for Prisma entity factories and tRPC context factories.
 */
import { describe, it, expect } from "vitest"
import {
  createMockJobSeeker,
  createMockEmployer,
  createMockJobPosting,
  createMockMatch,
} from "./create-entities"
import {
  createMockSeekerContext,
  createMockEmployerContext,
  createMockAdminContext,
  createMockProtectedContext,
  createMockOnboardingContext,
} from "./create-context"

// ---------------------------------------------------------------------------
// Entity Factories
// ---------------------------------------------------------------------------

describe("createMockJobSeeker", () => {
  it("returns a valid JobSeeker-shaped object with defaults", () => {
    const seeker = createMockJobSeeker()

    expect(seeker.id).toBeDefined()
    expect(typeof seeker.id).toBe("string")
    expect(seeker.clerkUserId).toBeDefined()
    expect(seeker.name).toBeDefined()
    expect(seeker.skills).toEqual(expect.any(Array))
    expect(seeker.isActive).toBe(true)
    expect(seeker.createdAt).toBeInstanceOf(Date)
    expect(seeker.updatedAt).toBeInstanceOf(Date)
  })

  it("merges overrides correctly", () => {
    const seeker = createMockJobSeeker({ name: "Alice", location: "NYC" })

    expect(seeker.name).toBe("Alice")
    expect(seeker.location).toBe("NYC")
    // Other defaults still present
    expect(seeker.id).toBeDefined()
    expect(seeker.isActive).toBe(true)
  })
})

describe("createMockEmployer", () => {
  it("returns a valid Employer-shaped object with defaults", () => {
    const employer = createMockEmployer()

    expect(employer.id).toBeDefined()
    expect(employer.clerkOrgId).toBeDefined()
    expect(employer.name).toBeDefined()
    expect(employer.locations).toEqual(expect.any(Array))
    expect(employer.benefits).toEqual(expect.any(Array))
    expect(employer.notifPrefs).toBeDefined()
    expect(employer.createdAt).toBeInstanceOf(Date)
  })

  it("merges overrides correctly", () => {
    const employer = createMockEmployer({ name: "Acme Corp", industry: "Tech" })

    expect(employer.name).toBe("Acme Corp")
    expect(employer.industry).toBe("Tech")
    expect(employer.id).toBeDefined()
  })
})

describe("createMockJobPosting", () => {
  it("returns a valid JobPosting-shaped object with defaults", () => {
    const posting = createMockJobPosting()

    expect(posting.id).toBeDefined()
    expect(posting.employerId).toBeDefined()
    expect(posting.title).toBeDefined()
    expect(posting.description).toBeDefined()
    expect(posting.requiredSkills).toEqual(expect.any(Array))
    expect(posting.status).toBe("DRAFT")
    expect(posting.experienceLevel).toBeDefined()
    expect(posting.employmentType).toBeDefined()
    expect(posting.locationType).toBeDefined()
  })

  it("merges overrides correctly", () => {
    const posting = createMockJobPosting({ title: "Senior Engineer", status: "ACTIVE" })

    expect(posting.title).toBe("Senior Engineer")
    expect(posting.status).toBe("ACTIVE")
  })
})

describe("createMockMatch", () => {
  it("returns a valid Match-shaped object with defaults", () => {
    const match = createMockMatch()

    expect(match.id).toBeDefined()
    expect(match.conversationId).toBeDefined()
    expect(match.jobPostingId).toBeDefined()
    expect(match.seekerId).toBeDefined()
    expect(match.employerId).toBeDefined()
    expect(match.confidenceScore).toBeDefined()
    expect(match.matchSummary).toBeDefined()
    expect(match.seekerStatus).toBe("PENDING")
    expect(match.employerStatus).toBe("PENDING")
  })

  it("merges overrides correctly", () => {
    const match = createMockMatch({ seekerStatus: "ACCEPTED", confidenceScore: "STRONG" })

    expect(match.seekerStatus).toBe("ACCEPTED")
    expect(match.confidenceScore).toBe("STRONG")
  })
})

// ---------------------------------------------------------------------------
// Context Factories
// ---------------------------------------------------------------------------

describe("createMockSeekerContext", () => {
  it("returns context with userId, seeker, and db", () => {
    const ctx = createMockSeekerContext()

    expect(ctx.userId).toBeDefined()
    expect(typeof ctx.userId).toBe("string")
    expect(ctx.seeker).toBeDefined()
    expect(ctx.seeker.id).toBeDefined()
    expect(ctx.db).toBeDefined()
    expect(ctx.userRole).toBe("JOB_SEEKER")
  })
})

describe("createMockEmployerContext", () => {
  it("returns context with userId, orgId, employer, and db", () => {
    const ctx = createMockEmployerContext()

    expect(ctx.userId).toBeDefined()
    expect(ctx.orgId).toBeDefined()
    expect(typeof ctx.orgId).toBe("string")
    expect(ctx.employer).toBeDefined()
    expect(ctx.employer.id).toBeDefined()
    expect(ctx.db).toBeDefined()
    expect(ctx.userRole).toBe("EMPLOYER")
  })
})

describe("createMockAdminContext", () => {
  it("returns context with orgRole set to org:admin", () => {
    const ctx = createMockAdminContext()

    expect(ctx.orgRole).toBe("org:admin")
    expect(ctx.employer).toBeDefined()
    expect(ctx.userRole).toBe("EMPLOYER")
  })
})

describe("createMockProtectedContext", () => {
  it("returns context with userId but no role-specific fields", () => {
    const ctx = createMockProtectedContext()

    expect(ctx.userId).toBeDefined()
    expect(ctx.db).toBeDefined()
  })
})

describe("createMockOnboardingContext", () => {
  it("returns context with userId and null userRole", () => {
    const ctx = createMockOnboardingContext()

    expect(ctx.userId).toBeDefined()
    expect(ctx.userRole).toBeNull()
    expect(ctx.db).toBeDefined()
  })
})
