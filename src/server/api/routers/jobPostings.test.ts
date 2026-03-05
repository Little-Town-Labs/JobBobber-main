/**
 * Task 2.3 — jobPostings router unit tests
 *
 * Prisma client is mocked — no live DB.
 *
 * Procedures tested:
 *   listMine, list, getById, create, update, updateStatus, delete
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

const mockPostingFindMany = vi.fn()
const mockPostingFindUnique = vi.fn()
const mockPostingCreate = vi.fn()
const mockPostingUpdate = vi.fn()
const mockPostingDelete = vi.fn()
const mockPostingCount = vi.fn()
const mockTransaction = vi.fn()

const EMPLOYER = {
  id: "emp_01",
  clerkOrgId: "org_clerk_01",
  name: "Acme Corp",
  industry: "Technology",
  size: "51-200",
  description: "We build things",
  culture: "Fast-paced",
  headquarters: "San Francisco",
  locations: ["SF"],
  websiteUrl: "https://acme.com",
  urls: {},
  benefits: [],
  logoUrl: null,
  byokApiKeyEncrypted: null,
  byokProvider: null,
  byokKeyValidatedAt: null,
  byokMaskedKey: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const mockDb = {
  employer: { findUnique: vi.fn().mockResolvedValue(EMPLOYER) },
  jobSeeker: { findUnique: vi.fn() },
  seekerSettings: { findFirst: vi.fn() },
  jobPosting: {
    findMany: mockPostingFindMany,
    findUnique: mockPostingFindUnique,
    create: mockPostingCreate,
    update: mockPostingUpdate,
    delete: mockPostingDelete,
    count: mockPostingCount,
  },
  jobSettings: { create: vi.fn() },
  $transaction: mockTransaction,
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const POSTING = {
  id: "post_01",
  employerId: "emp_01",
  title: "Senior Engineer",
  department: "Engineering",
  description: "Build cool stuff",
  responsibilities: "Lead the team",
  requiredSkills: ["TypeScript", "React"],
  preferredSkills: ["GraphQL"],
  experienceLevel: "SENIOR" as const,
  employmentType: "FULL_TIME" as const,
  locationType: "REMOTE" as const,
  locationReq: null,
  salaryMin: 120000,
  salaryMax: 180000,
  benefits: ["RSUs"],
  whyApply: "Great team",
  status: "DRAFT" as const,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const ACTIVE_POSTING = { ...POSTING, id: "post_02", status: "ACTIVE" as const }

// ---------------------------------------------------------------------------
// Helper: create jobPostings caller
// ---------------------------------------------------------------------------

async function makePostingsCaller(ctx?: {
  userId?: string | null
  orgId?: string | null
  orgRole?: "org:admin" | "org:member" | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { jobPostingsRouter } = await import("@/server/api/routers/jobPostings")

  return createCallerFactory(createTRPCRouter({ jobPostings: jobPostingsRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx?.userId ?? "user_clerk_01",
    orgId: ctx?.orgId ?? "org_clerk_01",
    orgRole: ctx?.orgRole ?? "org:admin",
    userRole: ctx?.userRole ?? "EMPLOYER",
    hasByokKey: false,
    employer: EMPLOYER as never,
  } as never)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.employer.findUnique.mockResolvedValue(EMPLOYER)
})

describe("jobPostings.listMine", () => {
  it("returns paginated list of own postings", async () => {
    mockPostingFindMany.mockResolvedValue([POSTING])
    const caller = await makePostingsCaller()
    const result = await caller.jobPostings.listMine({})

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.id).toBe("post_01")
    expect(mockPostingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employerId: "emp_01" }),
      }),
    )
  })

  it("filters by status", async () => {
    mockPostingFindMany.mockResolvedValue([])
    const caller = await makePostingsCaller()
    await caller.jobPostings.listMine({ status: "ACTIVE" })

    expect(mockPostingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employerId: "emp_01", status: "ACTIVE" }),
      }),
    )
  })
})

describe("jobPostings.list", () => {
  it("returns only ACTIVE postings for public access", async () => {
    mockPostingFindMany.mockResolvedValue([ACTIVE_POSTING])
    const caller = await makePostingsCaller({ userId: null, orgId: null, userRole: null })
    const result = await caller.jobPostings.list({})

    expect(mockPostingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    )
    expect(result.items).toHaveLength(1)
  })

  it("filters by experienceLevel and locationType", async () => {
    mockPostingFindMany.mockResolvedValue([])
    const caller = await makePostingsCaller({ userId: null, orgId: null, userRole: null })
    await caller.jobPostings.list({
      experienceLevel: "SENIOR",
      locationType: "REMOTE",
    })

    expect(mockPostingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          experienceLevel: "SENIOR",
          locationType: "REMOTE",
        }),
      }),
    )
  })
})

describe("jobPostings.getById", () => {
  it("returns full posting for owning employer", async () => {
    mockPostingFindUnique.mockResolvedValue(POSTING)
    const caller = await makePostingsCaller()
    const result = await caller.jobPostings.getById({ id: "post_01" })

    expect(result).toBeDefined()
    expect(result!.id).toBe("post_01")
    expect(result).toHaveProperty("createdAt")
  })

  it("returns public posting for non-owner (active only)", async () => {
    mockPostingFindUnique.mockResolvedValue(ACTIVE_POSTING)
    // getById is publicProcedure — employer.findUnique called once in handler for ownership check
    mockDb.employer.findUnique.mockResolvedValueOnce(null)
    const caller = await makePostingsCaller({ orgId: "org_other", userRole: "EMPLOYER" })
    const result = await caller.jobPostings.getById({ id: "post_02" })

    expect(result).toBeDefined()
    expect(result).not.toHaveProperty("createdAt")
  })

  it("returns error for non-active posting accessed by non-owner", async () => {
    mockPostingFindUnique.mockResolvedValue(POSTING) // DRAFT status
    mockDb.employer.findUnique.mockResolvedValueOnce(null)
    const caller = await makePostingsCaller({ orgId: "org_other", userRole: "EMPLOYER" })
    await expect(caller.jobPostings.getById({ id: "post_01" })).rejects.toThrow()
  })
})

describe("jobPostings.create", () => {
  it("creates posting + JobSettings in transaction", async () => {
    const createdPosting = { ...POSTING }
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        jobPosting: { create: mockPostingCreate.mockResolvedValue(createdPosting) },
        jobSettings: { create: mockDb.jobSettings.create.mockResolvedValue({}) },
      })
    })

    const caller = await makePostingsCaller()
    const result = await caller.jobPostings.create({
      title: "Senior Engineer",
      description: "Build cool stuff",
      experienceLevel: "SENIOR",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      requiredSkills: ["TypeScript"],
    })

    expect(mockTransaction).toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it("defaults status to DRAFT", async () => {
    const createdPosting = { ...POSTING, status: "DRAFT" }
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        jobPosting: { create: mockPostingCreate.mockResolvedValue(createdPosting) },
        jobSettings: { create: mockDb.jobSettings.create.mockResolvedValue({}) },
      })
    })

    const caller = await makePostingsCaller()
    const result = await caller.jobPostings.create({
      title: "Junior Dev",
      description: "Learn things",
      experienceLevel: "ENTRY",
      employmentType: "FULL_TIME",
      locationType: "REMOTE",
      requiredSkills: [],
    })

    expect(result!.status).toBe("DRAFT")
  })

  it("validates salaryMax >= salaryMin", async () => {
    const caller = await makePostingsCaller()
    await expect(
      caller.jobPostings.create({
        title: "Engineer",
        description: "Build things",
        experienceLevel: "MID",
        employmentType: "FULL_TIME",
        locationType: "REMOTE",
        requiredSkills: ["TypeScript"],
        salaryMin: 150000,
        salaryMax: 100000,
      }),
    ).rejects.toThrow()
  })
})

describe("jobPostings.update", () => {
  it("partial update works", async () => {
    mockPostingFindUnique.mockResolvedValue(POSTING)
    mockPostingUpdate.mockResolvedValue({ ...POSTING, title: "Staff Engineer" })
    const caller = await makePostingsCaller()
    const result = await caller.jobPostings.update({
      id: "post_01",
      title: "Staff Engineer",
    })

    expect(mockPostingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Staff Engineer" }),
      }),
    )
    expect(result).toBeDefined()
  })

  it("rejects update from non-owner", async () => {
    mockPostingFindUnique.mockResolvedValue({ ...POSTING, employerId: "other_emp" })
    const caller = await makePostingsCaller()
    await expect(caller.jobPostings.update({ id: "post_01", title: "Nope" })).rejects.toThrow()
  })
})

describe("jobPostings.updateStatus", () => {
  it("valid transition DRAFT → ACTIVE succeeds", async () => {
    const posting = { ...POSTING, status: "DRAFT", requiredSkills: ["TypeScript"] }
    mockPostingFindUnique.mockResolvedValue(posting)
    mockPostingUpdate.mockResolvedValue({ ...posting, status: "ACTIVE" })
    const caller = await makePostingsCaller()
    const result = await caller.jobPostings.updateStatus({
      id: "post_01",
      status: "ACTIVE",
    })
    expect(result!.status).toBe("ACTIVE")
  })

  it("valid transition ACTIVE → PAUSED succeeds", async () => {
    mockPostingFindUnique.mockResolvedValue(ACTIVE_POSTING)
    mockPostingUpdate.mockResolvedValue({ ...ACTIVE_POSTING, status: "PAUSED" })
    const caller = await makePostingsCaller()
    const result = await caller.jobPostings.updateStatus({
      id: "post_02",
      status: "PAUSED",
    })
    expect(result!.status).toBe("PAUSED")
  })

  it("invalid transition CLOSED → ACTIVE rejected", async () => {
    mockPostingFindUnique.mockResolvedValue({ ...POSTING, status: "CLOSED" })
    const caller = await makePostingsCaller()
    await expect(
      caller.jobPostings.updateStatus({ id: "post_01", status: "ACTIVE" }),
    ).rejects.toThrow()
  })

  it("DRAFT → ACTIVE blocked when missing requiredSkills", async () => {
    mockPostingFindUnique.mockResolvedValue({
      ...POSTING,
      status: "DRAFT",
      requiredSkills: [],
    })
    const caller = await makePostingsCaller()
    await expect(
      caller.jobPostings.updateStatus({ id: "post_01", status: "ACTIVE" }),
    ).rejects.toThrow()
  })

  it("DRAFT → ACTIVE blocked when title is empty", async () => {
    mockPostingFindUnique.mockResolvedValue({
      ...POSTING,
      status: "DRAFT",
      title: "",
      requiredSkills: ["TypeScript"],
    })
    const caller = await makePostingsCaller()
    await expect(
      caller.jobPostings.updateStatus({ id: "post_01", status: "ACTIVE" }),
    ).rejects.toThrow()
  })
})

describe("jobPostings.delete", () => {
  it("DRAFT posting deleted successfully", async () => {
    mockPostingFindUnique.mockResolvedValue(POSTING) // status: DRAFT
    mockPostingDelete.mockResolvedValue(POSTING)
    const caller = await makePostingsCaller()
    await caller.jobPostings.delete({ id: "post_01" })
    expect(mockPostingDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "post_01" } }),
    )
  })

  it("non-DRAFT posting deletion rejected", async () => {
    mockPostingFindUnique.mockResolvedValue(ACTIVE_POSTING)
    const caller = await makePostingsCaller()
    await expect(caller.jobPostings.delete({ id: "post_02" })).rejects.toThrow()
  })
})
