/**
 * Task 2.1 — jobSeekers router unit tests
 *
 * Prisma client is mocked — no live DB.
 * Tests FAIL before full implementation exists (stubs return null).
 *
 * Procedures tested:
 *   getMe, getById, updateProfile, setActiveStatus
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

const mockJobSeekerFindUnique = vi.fn()
const mockJobSeekerUpdate = vi.fn()

const mockDb = {
  jobSeeker: {
    findUnique: mockJobSeekerFindUnique,
    update: mockJobSeekerUpdate,
  },
  seekerSettings: { findFirst: vi.fn() },
  employer: { findUnique: vi.fn() },
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// ---------------------------------------------------------------------------
// Fixture: a realistic seeker row as Prisma would return it
// ---------------------------------------------------------------------------

const SEEKER = {
  id: "cld_seeker_01",
  clerkUserId: "user_clerk_01",
  name: "Jane Doe",
  headline: "Senior Engineer",
  bio: "10 years building things",
  resumeUrl: "https://blob.vercel-storage.com/resumes/jane-resume.pdf",
  parsedResume: null,
  experience: [{ title: "Engineer", company: "Acme", startDate: "2020-01" }],
  education: [{ degree: "BS Computer Science", school: "MIT" }],
  skills: ["TypeScript", "React", "Node.js"],
  urls: [],
  profileUrls: [],
  location: "Austin, TX",
  relocationPreference: null,
  profileCompleteness: 90,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

// ---------------------------------------------------------------------------
// Helper: create a jobSeekers caller
// ---------------------------------------------------------------------------

async function makeJobSeekersCaller(ctx: {
  userId?: string | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { jobSeekersRouter } = await import("@/server/api/routers/jobSeekers")

  return createCallerFactory(createTRPCRouter({ jobSeekers: jobSeekersRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx.userId ?? "user_clerk_01",
    orgId: null,
    orgRole: null,
    userRole: ctx.userRole ?? "JOB_SEEKER",
    hasByokKey: false,
  } as never)
}

// ---------------------------------------------------------------------------
// getMe
// ---------------------------------------------------------------------------

describe("jobSeekers.getMe", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Middleware findUnique: returns seeker for the auth'd user
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
  })

  it("returns the authenticated seeker profile", async () => {
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.getMe()

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      id: SEEKER.id,
      name: SEEKER.name,
      headline: SEEKER.headline,
    })
  })

  it("response does NOT include parsedResume", async () => {
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.getMe()

    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty("parsedResume")
  })

  it("response does NOT include byokApiKeyEncrypted or other SeekerSettings fields", async () => {
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.getMe()

    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("minSalary")
    expect(result).not.toHaveProperty("dealBreakers")
  })

  it("profileCompleteness is a number in [0, 100]", async () => {
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.getMe()

    expect(typeof (result as Record<string, unknown>)?.profileCompleteness).toBe("number")
    expect((result as Record<string, unknown>)?.profileCompleteness).toBeGreaterThanOrEqual(0)
    expect((result as Record<string, unknown>)?.profileCompleteness).toBeLessThanOrEqual(100)
  })

  it("throws UNAUTHORIZED when userRole is not JOB_SEEKER", async () => {
    mockJobSeekerFindUnique.mockResolvedValue(null)
    const caller = await makeJobSeekersCaller({ userRole: "EMPLOYER" })
    await expect(caller.jobSeekers.getMe()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe("jobSeekers.getById", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns a public seeker profile for a valid id", async () => {
    // No middleware lookup needed (publicProcedure) — mock for the procedure itself
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    const caller = await makeJobSeekersCaller({ userRole: null })
    const result = await caller.jobSeekers.getById({ id: SEEKER.id })

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ id: SEEKER.id, name: SEEKER.name })
  })

  it("response does NOT include resumeUrl", async () => {
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    const caller = await makeJobSeekersCaller({ userRole: null })
    const result = await caller.jobSeekers.getById({ id: SEEKER.id })

    expect(result).not.toHaveProperty("resumeUrl")
  })

  it("response does NOT include parsedResume", async () => {
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    const caller = await makeJobSeekersCaller({ userRole: null })
    const result = await caller.jobSeekers.getById({ id: SEEKER.id })

    expect(result).not.toHaveProperty("parsedResume")
  })

  it("response does NOT include createdAt", async () => {
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    const caller = await makeJobSeekersCaller({ userRole: null })
    const result = await caller.jobSeekers.getById({ id: SEEKER.id })

    expect(result).not.toHaveProperty("createdAt")
  })

  it("response does NOT include SeekerSettings fields", async () => {
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    const caller = await makeJobSeekersCaller({ userRole: null })
    const result = await caller.jobSeekers.getById({ id: SEEKER.id })

    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("minSalary")
  })

  it("throws NOT_FOUND for an unknown id", async () => {
    mockJobSeekerFindUnique.mockResolvedValue(null)
    const caller = await makeJobSeekersCaller({ userRole: null })
    await expect(caller.jobSeekers.getById({ id: "cld_unknown_xxxx" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })

  it("returns profile even when isActive = false", async () => {
    mockJobSeekerFindUnique.mockResolvedValue({ ...SEEKER, isActive: false })
    const caller = await makeJobSeekersCaller({ userRole: null })
    const result = await caller.jobSeekers.getById({ id: SEEKER.id })

    expect(result).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe("jobSeekers.updateProfile", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Middleware: return seeker
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    // Update: return updated seeker
    mockJobSeekerUpdate.mockResolvedValue({ ...SEEKER, name: "Updated Name" })
  })

  it("empty input {} is a valid no-op call", async () => {
    mockJobSeekerUpdate.mockResolvedValue(SEEKER)
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.updateProfile({})
    expect(result).not.toBeNull()
  })

  it("name update sets the field and recalculates profileCompleteness", async () => {
    const updated = { ...SEEKER, name: "New Name", profileCompleteness: 95 }
    mockJobSeekerUpdate.mockResolvedValue(updated)
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.updateProfile({ name: "New Name" })

    expect((result as Record<string, unknown>)?.name).toBe("New Name")
    expect(typeof (result as Record<string, unknown>)?.profileCompleteness).toBe("number")
  })

  it("experience update is full-replacement", async () => {
    const newExp = [
      {
        id: "cld_exp_01",
        jobTitle: "CTO",
        company: "Startup",
        startDate: "2023-01",
        endDate: "present",
      },
    ]
    const updated = { ...SEEKER, experience: newExp }
    mockJobSeekerUpdate.mockResolvedValue(updated)

    const caller = await makeJobSeekersCaller({})
    await caller.jobSeekers.updateProfile({ experience: newExp })

    const updateCall = mockJobSeekerUpdate.mock.calls[0]?.[0]
    expect(updateCall?.data?.experience).toEqual(newExp)
  })

  it("skills array is capped at 50 entries", async () => {
    const tooManySkills = Array.from({ length: 60 }, (_, i) => `Skill${i}`)
    const caller = await makeJobSeekersCaller({})
    await expect(caller.jobSeekers.updateProfile({ skills: tooManySkills })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("urls array is capped at 10 entries", async () => {
    const tooManyUrls = Array.from({ length: 11 }, (_, i) => ({
      id: `url_${i}`,
      label: `Link ${i}`,
      url: `https://example.com/${i}`,
    }))
    const caller = await makeJobSeekersCaller({})
    await expect(caller.jobSeekers.updateProfile({ urls: tooManyUrls })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("invalid URL in urls throws BAD_REQUEST", async () => {
    const caller = await makeJobSeekersCaller({})
    await expect(
      caller.jobSeekers.updateProfile({
        urls: [{ id: "url_1", label: "My Link", url: "not-a-url" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("returns FullJobSeekerProfile after update", async () => {
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.updateProfile({ name: "Jane" })

    expect(result).not.toBeNull()
    expect(result).toMatchObject({ id: SEEKER.id })
  })
})

// ---------------------------------------------------------------------------
// setActiveStatus
// ---------------------------------------------------------------------------

describe("jobSeekers.setActiveStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Middleware: return seeker with isActive = true
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
  })

  it("sets isActive = false on an active profile and returns updated status", async () => {
    mockJobSeekerUpdate.mockResolvedValue({ ...SEEKER, isActive: false })
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.setActiveStatus({ isActive: false })

    expect((result as Record<string, unknown>)?.isActive).toBe(false)
  })

  it("sets isActive = true on an inactive profile and returns updated status", async () => {
    mockJobSeekerFindUnique.mockResolvedValue({ ...SEEKER, isActive: false })
    mockJobSeekerUpdate.mockResolvedValue({ ...SEEKER, isActive: true })
    const caller = await makeJobSeekersCaller({})
    const result = await caller.jobSeekers.setActiveStatus({ isActive: true })

    expect((result as Record<string, unknown>)?.isActive).toBe(true)
  })

  it("throws CONFLICT when setting isActive = true on an already-active profile", async () => {
    const caller = await makeJobSeekersCaller({}) // seeker.isActive = true
    await expect(caller.jobSeekers.setActiveStatus({ isActive: true })).rejects.toMatchObject({
      code: "CONFLICT",
    })
  })

  it("throws CONFLICT when setting isActive = false on an already-inactive profile", async () => {
    mockJobSeekerFindUnique.mockResolvedValue({ ...SEEKER, isActive: false })
    const caller = await makeJobSeekersCaller({})
    await expect(caller.jobSeekers.setActiveStatus({ isActive: false })).rejects.toMatchObject({
      code: "CONFLICT",
    })
  })
})
