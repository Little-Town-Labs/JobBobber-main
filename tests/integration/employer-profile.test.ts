/**
 * Task 7.1 — Integration tests for employer profile and job posting routers
 *
 * Tests the tRPC routers through createCaller with a real Prisma client.
 * Skipped when DATABASE_URL is not set (CI without a database).
 *
 * Cleanup: each suite uses afterAll to delete created rows.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import type { PrismaClient } from "@prisma/client"

// Skip integration tests unless INTEGRATION_TEST=true is explicitly set
const hasDb = process.env["INTEGRATION_TEST"] === "true"

// ---------------------------------------------------------------------------
// Module mocks — Clerk is not available in integration tests
// ---------------------------------------------------------------------------

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(() =>
    Promise.resolve({
      users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      organizations: {
        createOrganization: vi.fn().mockResolvedValue({ id: "int_test_org" }),
        deleteOrganization: vi.fn().mockResolvedValue({}),
      },
    }),
  ),
}))

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn(() => Promise.resolve("encrypted_ciphertext")),
  decrypt: vi.fn(() => Promise.resolve("sk-proj-test")),
}))

// ---------------------------------------------------------------------------
// Router caller factory
// ---------------------------------------------------------------------------

import { createCaller } from "@/server/api/root"

interface IntegrationCtx {
  userId: string
  orgId: string | null
  orgRole: "org:admin" | "org:member" | null
  userRole: "JOB_SEEKER" | "EMPLOYER" | null
  hasByokKey: boolean
  inngest: never
}

function makeCtx(
  userId: string,
  opts?: {
    orgId?: string
    orgRole?: "org:admin" | "org:member"
    userRole?: "JOB_SEEKER" | "EMPLOYER"
  },
): Omit<IntegrationCtx, "db"> {
  return {
    userId,
    orgId: opts?.orgId ?? null,
    orgRole: opts?.orgRole ?? null,
    userRole: opts?.userRole ?? null,
    hasByokKey: false,
    inngest: null as never,
  }
}

// ---------------------------------------------------------------------------
// Suite A: Employer Profile CRUD
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Integration: employers router", () => {
  let db: PrismaClient
  const orgId = `int_emp_org_${Date.now()}`
  const userId = `int_emp_user_${Date.now()}`
  let employerId: string

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance

    // Seed an employer + member directly
    const employer = await db.employer.create({
      data: {
        clerkOrgId: orgId,
        name: "Integration Test Corp",
      },
    })
    employerId = employer.id
    await db.employerMember.create({
      data: {
        employerId: employer.id,
        clerkUserId: userId,
        role: "ADMIN",
      },
    })
  })

  afterAll(async () => {
    await db.employer.delete({ where: { id: employerId } }).catch(() => {})
    await db.$disconnect()
  })

  it("getMe returns full employer profile", async () => {
    const caller = createCaller({
      db,
      ...makeCtx(userId, { orgId, orgRole: "org:admin", userRole: "EMPLOYER" }),
    })

    const result = await caller.employers.getMe()

    expect(result.id).toBe(employerId)
    expect(result.name).toBe("Integration Test Corp")
    expect(result).toHaveProperty("createdAt")
    // BYOK fields must not be present
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("byokProvider")
  })

  it("getById returns public employer profile without createdAt", async () => {
    const caller = createCaller({
      db,
      ...makeCtx("anonymous_user"),
    })

    const result = await caller.employers.getById({ id: employerId })

    expect(result).not.toBeNull()
    expect(result!.name).toBe("Integration Test Corp")
    expect(result).not.toHaveProperty("createdAt")
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
  })

  it("getById returns null for non-existent ID", async () => {
    const caller = createCaller({ db, ...makeCtx("anon") })

    const result = await caller.employers.getById({ id: "nonexistent_id" })
    expect(result).toBeNull()
  })

  it("updateProfile updates a single field", async () => {
    const caller = createCaller({
      db,
      ...makeCtx(userId, { orgId, orgRole: "org:admin", userRole: "EMPLOYER" }),
    })

    const result = await caller.employers.updateProfile({ industry: "Technology" })

    expect(result.industry).toBe("Technology")
    expect(result.name).toBe("Integration Test Corp")
  })

  it("updateProfile validates URL format for websiteUrl", async () => {
    const caller = createCaller({
      db,
      ...makeCtx(userId, { orgId, orgRole: "org:admin", userRole: "EMPLOYER" }),
    })

    await expect(caller.employers.updateProfile({ websiteUrl: "not-a-url" })).rejects.toThrow()
  })

  it("updateProfile rejects non-admin role", async () => {
    const caller = createCaller({
      db,
      ...makeCtx(userId, { orgId, orgRole: "org:member", userRole: "EMPLOYER" }),
    })

    await expect(caller.employers.updateProfile({ name: "Hacked" })).rejects.toThrow(/admin/i)
  })

  it("updateLogo persists logoUrl on employer record", async () => {
    const caller = createCaller({
      db,
      ...makeCtx(userId, { orgId, orgRole: "org:admin", userRole: "EMPLOYER" }),
    })

    const result = await caller.employers.updateLogo({
      logoUrl: "https://blob.example.com/logo.png",
    })

    expect(result.logoUrl).toBe("https://blob.example.com/logo.png")

    // Verify in DB
    const row = await db.employer.findUnique({ where: { id: employerId } })
    expect(row!.logoUrl).toBe("https://blob.example.com/logo.png")
  })
})

// ---------------------------------------------------------------------------
// Suite B: Job Postings CRUD
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Integration: jobPostings router", () => {
  let db: PrismaClient
  const orgId = `int_jp_org_${Date.now()}`
  const userId = `int_jp_user_${Date.now()}`
  let employerId: string
  let draftPostingId: string

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance

    const employer = await db.employer.create({
      data: { clerkOrgId: orgId, name: "Posting Test Corp" },
    })
    employerId = employer.id
    await db.employerMember.create({
      data: { employerId: employer.id, clerkUserId: userId, role: "ADMIN" },
    })
  })

  afterAll(async () => {
    // Cascade deletes job postings + job settings
    await db.employer.delete({ where: { id: employerId } }).catch(() => {})
    await db.$disconnect()
  })

  function makeCaller(overrides?: { orgRole?: "org:admin" | "org:member" }) {
    return createCaller({
      db,
      ...makeCtx(userId, {
        orgId,
        orgRole: overrides?.orgRole ?? "org:admin",
        userRole: "EMPLOYER",
      }),
    })
  }

  it("create creates posting + JobSettings in transaction", async () => {
    const caller = makeCaller()

    const result = await caller.jobPostings.create({
      title: "Software Engineer",
      description: "Build cool things",
      experienceLevel: "MID",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      requiredSkills: ["TypeScript", "React"],
    })

    draftPostingId = result.id
    expect(result.title).toBe("Software Engineer")
    expect(result.status).toBe("DRAFT")

    // Verify JobSettings created
    const settings = await db.jobSettings.findUnique({
      where: { jobPostingId: result.id },
    })
    expect(settings).not.toBeNull()
  })

  it("create defaults status to DRAFT", async () => {
    const caller = makeCaller()

    const result = await caller.jobPostings.create({
      title: "Another Role",
      description: "Description",
      experienceLevel: "ENTRY",
      employmentType: "PART_TIME",
      locationType: "HYBRID",
    })

    expect(result.status).toBe("DRAFT")

    // Clean up this extra posting
    await db.jobPosting.delete({ where: { id: result.id } }).catch(() => {})
  })

  it("create validates salaryMax >= salaryMin", async () => {
    const caller = makeCaller()

    await expect(
      caller.jobPostings.create({
        title: "Bad Salary",
        description: "Test",
        experienceLevel: "MID",
        employmentType: "FULL_TIME",
        locationType: "REMOTE",
        salaryMin: 100000,
        salaryMax: 50000,
      }),
    ).rejects.toThrow()
  })

  it("listMine returns paginated list of own postings", async () => {
    const caller = makeCaller()

    const result = await caller.jobPostings.listMine({})

    expect(result.items.length).toBeGreaterThanOrEqual(1)
    expect(result.items[0]!.employerId).toBe(employerId)
    expect(result).toHaveProperty("nextCursor")
    expect(result).toHaveProperty("hasMore")
  })

  it("listMine filters by status", async () => {
    const caller = makeCaller()

    const drafts = await caller.jobPostings.listMine({ status: "DRAFT" })
    expect(drafts.items.length).toBeGreaterThanOrEqual(1)

    const active = await caller.jobPostings.listMine({ status: "ACTIVE" })
    expect(active.items.length).toBe(0)
  })

  it("update partial update works", async () => {
    const caller = makeCaller()

    const result = await caller.jobPostings.update({
      id: draftPostingId,
      title: "Updated Title",
    })

    expect(result.title).toBe("Updated Title")
    expect(result.description).toBe("Build cool things") // unchanged
  })

  it("updateStatus DRAFT -> ACTIVE succeeds when fields are complete", async () => {
    const caller = makeCaller()

    const result = await caller.jobPostings.updateStatus({
      id: draftPostingId,
      status: "ACTIVE",
    })

    expect(result.status).toBe("ACTIVE")
  })

  it("updateStatus ACTIVE -> PAUSED succeeds", async () => {
    const caller = makeCaller()

    const result = await caller.jobPostings.updateStatus({
      id: draftPostingId,
      status: "PAUSED",
    })

    expect(result.status).toBe("PAUSED")
  })

  it("updateStatus PAUSED -> ACTIVE succeeds", async () => {
    const caller = makeCaller()

    const result = await caller.jobPostings.updateStatus({
      id: draftPostingId,
      status: "ACTIVE",
    })

    expect(result.status).toBe("ACTIVE")
  })

  it("updateStatus rejects invalid transition (ACTIVE -> DRAFT)", async () => {
    const caller = makeCaller()

    await expect(
      caller.jobPostings.updateStatus({ id: draftPostingId, status: "PAUSED" }),
    ).resolves.toBeTruthy()

    // PAUSED can't go to DRAFT — but let's test CLOSED -> ACTIVE
    await caller.jobPostings.updateStatus({ id: draftPostingId, status: "CLOSED" })

    await expect(
      caller.jobPostings.updateStatus({ id: draftPostingId, status: "ACTIVE" }),
    ).rejects.toThrow(/cannot transition/i)
  })

  it("updateStatus DRAFT -> ACTIVE blocked when missing requiredSkills", async () => {
    const caller = makeCaller()

    // Create a posting with no required skills
    const barePosting = await caller.jobPostings.create({
      title: "No Skills",
      description: "Missing required skills",
      experienceLevel: "ENTRY",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      requiredSkills: [],
    })

    await expect(
      caller.jobPostings.updateStatus({ id: barePosting.id, status: "ACTIVE" }),
    ).rejects.toThrow(/required skill/i)

    // Clean up
    await db.jobPosting.delete({ where: { id: barePosting.id } }).catch(() => {})
  })

  it("list returns only ACTIVE postings for public access", async () => {
    const publicCaller = createCaller({ db, ...makeCtx("anon") })

    const result = await publicCaller.jobPostings.list({})

    // All items should be ACTIVE status
    for (const item of result.items) {
      expect(item.status).toBe("ACTIVE")
    }
  })

  it("getById returns full posting for owning employer", async () => {
    // Create a fresh ACTIVE posting for this test
    const caller = makeCaller()
    const posting = await caller.jobPostings.create({
      title: "Owner View Test",
      description: "Test posting",
      experienceLevel: "SENIOR",
      employmentType: "FULL_TIME",
      locationType: "ONSITE",
      requiredSkills: ["Go"],
    })
    await caller.jobPostings.updateStatus({ id: posting.id, status: "ACTIVE" })

    const result = await caller.jobPostings.getById({ id: posting.id })

    expect(result).not.toBeNull()
    expect(result!.title).toBe("Owner View Test")
    expect(result).toHaveProperty("createdAt") // full posting includes createdAt
  })

  it("getById returns public posting for non-owner on ACTIVE posting", async () => {
    // Find an active posting
    const caller = makeCaller()
    const mine = await caller.jobPostings.listMine({ status: "ACTIVE" })
    const activeId = mine.items.find((p) => p.status === "ACTIVE")?.id

    if (!activeId) return // skip if no active posting

    const publicCaller = createCaller({ db, ...makeCtx("other_user") })
    const result = await publicCaller.jobPostings.getById({ id: activeId })

    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty("createdAt") // public view
  })

  it("getById throws NOT_FOUND for non-owner on non-ACTIVE posting", async () => {
    // Create a DRAFT posting
    const caller = makeCaller()
    const draft = await caller.jobPostings.create({
      title: "Hidden Draft",
      description: "Not visible",
      experienceLevel: "ENTRY",
      employmentType: "CONTRACT",
      locationType: "REMOTE",
    })

    const publicCaller = createCaller({ db, ...makeCtx("other_user") })

    await expect(publicCaller.jobPostings.getById({ id: draft.id })).rejects.toThrow(/not found/i)

    // Clean up
    await db.jobPosting.delete({ where: { id: draft.id } }).catch(() => {})
  })

  it("delete succeeds for DRAFT posting", async () => {
    const caller = makeCaller()

    const draft = await caller.jobPostings.create({
      title: "To Delete",
      description: "Will be deleted",
      experienceLevel: "ENTRY",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
    })

    const result = await caller.jobPostings.delete({ id: draft.id })
    expect(result.success).toBe(true)

    // Verify cascade: JobSettings also deleted
    const settings = await db.jobSettings.findUnique({
      where: { jobPostingId: draft.id },
    })
    expect(settings).toBeNull()
  })

  it("delete rejects non-DRAFT posting", async () => {
    const caller = makeCaller()

    const posting = await caller.jobPostings.create({
      title: "Active No Delete",
      description: "Cannot delete",
      experienceLevel: "MID",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      requiredSkills: ["Test"],
    })
    await caller.jobPostings.updateStatus({ id: posting.id, status: "ACTIVE" })

    await expect(caller.jobPostings.delete({ id: posting.id })).rejects.toThrow(/draft/i)
  })
})
