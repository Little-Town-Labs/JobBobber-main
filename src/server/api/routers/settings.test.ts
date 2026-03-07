/**
 * Feature 8: Private Negotiation Parameters — Settings Router Tests
 *
 * Covers: Task 1.1 (feature flag gating), Task 1.3 (input validation),
 * Task 2.1 (seeker CRUD), Task 2.3 (job settings CRUD), Task 3.1 (privacy boundary).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue({
    users: { updateUserMetadata: vi.fn() },
  }),
}))

// Mock the PRIVATE_PARAMS flag — tests toggle this
let flagEnabled = true
vi.mock("@/lib/flags", () => ({
  PRIVATE_PARAMS: () => flagEnabled,
  SEEKER_PROFILE: () => true,
  EMPLOYER_PROFILE: () => true,
  AI_MATCHING: () => true,
  MATCH_DASHBOARD: () => true,
  FEEDBACK_INSIGHTS: () => true,
  assertFlagEnabled: async (flagFn: () => boolean | Promise<boolean>) => {
    const enabled = await flagFn()
    if (!enabled) {
      const { TRPCError } = await import("@trpc/server")
      throw new TRPCError({ code: "NOT_FOUND", message: "This feature is not yet available." })
    }
  },
}))

const EMPLOYER = {
  id: "emp_01",
  clerkOrgId: "org_clerk_01",
  name: "Acme Corp",
  industry: "Technology",
  size: "51-200",
  description: "We build things",
  culture: null,
  headquarters: null,
  locations: [],
  websiteUrl: null,
  urls: {},
  benefits: [],
  logoUrl: null,
  byokApiKeyEncrypted: null,
  byokProvider: null,
  byokKeyValidatedAt: null,
  byokMaskedKey: null,
  notifPrefs: {},
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const SEEKER = {
  id: "seeker_01",
  clerkUserId: "user_seeker_01",
  name: "Jane Doe",
  headline: "Engineer",
  skills: ["TypeScript"],
  experience: [],
  education: [],
  location: "NYC",
  profileCompleteness: 80,
  isActive: true,
  resumeUrl: null,
  resumeOriginalName: null,
  resumeParsedData: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

const JOB_POSTING = {
  id: "clxyz1234567890abcdef",
  employerId: "emp_01",
  title: "Senior Engineer",
  status: "ACTIVE",
}

/** What Prisma returns with the select clause (no BYOK fields) */
const SEEKER_SETTINGS_SELECTED = {
  id: "ss_01",
  minSalary: 120000,
  salaryRules: { type: "flexible_for_equity" },
  dealBreakers: ["No remote"],
  priorities: ["Work-life balance", "Compensation"],
  exclusions: ["BigCorp Inc"],
  customPrompt: "Be assertive on salary",
}

/** What Prisma returns with the select clause (no BYOK fields) */
const JOB_SETTINGS_SELECTED = {
  id: "js_01",
  trueMaxSalary: 180000,
  minQualOverride: { yearsExperience: 3 },
  willingToTrain: ["Kubernetes", "GraphQL"],
  urgency: "HIGH" as const,
  priorityAttrs: ["Culture fit", "Technical depth"],
  customPrompt: "Prioritize culture fit",
}

const mockDb = {
  employer: { findUnique: vi.fn().mockResolvedValue(EMPLOYER), update: vi.fn() },
  jobSeeker: { findUnique: vi.fn().mockResolvedValue(SEEKER) },
  seekerSettings: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(SEEKER_SETTINGS_SELECTED),
  },
  jobSettings: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(JOB_SETTINGS_SELECTED),
  },
  jobPosting: {
    findUnique: vi.fn().mockResolvedValue(JOB_POSTING),
  },
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

async function makeCaller(ctx?: {
  userId?: string | null
  orgId?: string | null
  orgRole?: "org:admin" | "org:member" | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { settingsRouter } = await import("@/server/api/routers/settings")

  return createCallerFactory(createTRPCRouter({ settings: settingsRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx?.userId ?? "user_seeker_01",
    orgId: ctx?.orgId ?? null,
    orgRole: ctx?.orgRole ?? null,
    userRole: ctx?.userRole ?? "JOB_SEEKER",
    hasByokKey: false,
    employer: EMPLOYER as never,
    seeker: SEEKER as never,
  } as never)
}

function makeEmployerCaller() {
  return makeCaller({
    userId: "user_emp_01",
    orgId: "org_clerk_01",
    orgRole: "org:admin",
    userRole: "EMPLOYER",
  })
}

function makeSeekerCaller() {
  return makeCaller({
    userId: "user_seeker_01",
    userRole: "JOB_SEEKER",
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  flagEnabled = true
  mockDb.employer.findUnique.mockResolvedValue(EMPLOYER)
  mockDb.jobSeeker.findUnique.mockResolvedValue(SEEKER)
  mockDb.seekerSettings.findUnique.mockResolvedValue(null)
  mockDb.seekerSettings.upsert.mockResolvedValue(SEEKER_SETTINGS_SELECTED)
  mockDb.jobSettings.findUnique.mockResolvedValue(null)
  mockDb.jobSettings.upsert.mockResolvedValue(JOB_SETTINGS_SELECTED)
  mockDb.jobPosting.findUnique.mockResolvedValue(JOB_POSTING)
})

// =========================================================================
// Task 1.1: Feature Flag Gating
// =========================================================================
describe("Feature flag gating (PRIVATE_PARAMS)", () => {
  it("getSeekerSettings rejects when flag OFF", async () => {
    flagEnabled = false
    const caller = await makeSeekerCaller()
    await expect(caller.settings.getSeekerSettings()).rejects.toThrow("not yet available")
  })

  it("updateSeekerSettings rejects when flag OFF", async () => {
    flagEnabled = false
    const caller = await makeSeekerCaller()
    await expect(caller.settings.updateSeekerSettings({ minSalary: 100000 })).rejects.toThrow(
      "not yet available",
    )
  })

  it("getJobSettings rejects when flag OFF", async () => {
    flagEnabled = false
    const caller = await makeEmployerCaller()
    await expect(
      caller.settings.getJobSettings({ jobPostingId: "clxyz1234567890abcdef" }),
    ).rejects.toThrow("not yet available")
  })

  it("updateJobSettings rejects when flag OFF", async () => {
    flagEnabled = false
    const caller = await makeEmployerCaller()
    await expect(
      caller.settings.updateJobSettings({
        jobPostingId: "clxyz1234567890abcdef",
        trueMaxSalary: 200000,
      }),
    ).rejects.toThrow("not yet available")
  })

  it("getSeekerSettings succeeds when flag ON", async () => {
    const caller = await makeSeekerCaller()
    const result = await caller.settings.getSeekerSettings()
    expect(result).toBeNull()
  })
})

// =========================================================================
// Task 1.3: Input Validation
// =========================================================================
describe("Input validation", () => {
  it("rejects negative salary for seeker", async () => {
    const caller = await makeSeekerCaller()
    await expect(caller.settings.updateSeekerSettings({ minSalary: -1 })).rejects.toThrow()
  })

  it("allows salary of 0 for seeker", async () => {
    const caller = await makeSeekerCaller()
    await expect(caller.settings.updateSeekerSettings({ minSalary: 0 })).resolves.toBeDefined()
  })

  it("rejects dealBreakers exceeding 20 items", async () => {
    const caller = await makeSeekerCaller()
    const items = Array.from({ length: 21 }, (_, i) => `item-${i}`)
    await expect(caller.settings.updateSeekerSettings({ dealBreakers: items })).rejects.toThrow()
  })

  it("rejects dealBreaker item exceeding 200 chars", async () => {
    const caller = await makeSeekerCaller()
    await expect(
      caller.settings.updateSeekerSettings({ dealBreakers: ["x".repeat(201)] }),
    ).rejects.toThrow()
  })

  it("rejects priorities exceeding 20 items", async () => {
    const caller = await makeSeekerCaller()
    const items = Array.from({ length: 21 }, (_, i) => `p-${i}`)
    await expect(caller.settings.updateSeekerSettings({ priorities: items })).rejects.toThrow()
  })

  it("rejects exclusions exceeding 20 items", async () => {
    const caller = await makeSeekerCaller()
    const items = Array.from({ length: 21 }, (_, i) => `e-${i}`)
    await expect(caller.settings.updateSeekerSettings({ exclusions: items })).rejects.toThrow()
  })

  it("rejects customPrompt exceeding 2000 chars", async () => {
    const caller = await makeSeekerCaller()
    await expect(
      caller.settings.updateSeekerSettings({ customPrompt: "x".repeat(2001) }),
    ).rejects.toThrow()
  })

  it("rejects negative trueMaxSalary for employer", async () => {
    const caller = await makeEmployerCaller()
    await expect(
      caller.settings.updateJobSettings({
        jobPostingId: "clxyz1234567890abcdef",
        trueMaxSalary: -5,
      }),
    ).rejects.toThrow()
  })

  it("rejects priorityAttrs exceeding 10 items", async () => {
    const caller = await makeEmployerCaller()
    const items = Array.from({ length: 11 }, (_, i) => `attr-${i}`)
    await expect(
      caller.settings.updateJobSettings({
        jobPostingId: "clxyz1234567890abcdef",
        priorityAttrs: items,
      }),
    ).rejects.toThrow()
  })

  it("rejects willingToTrain exceeding 20 items", async () => {
    const caller = await makeEmployerCaller()
    const items = Array.from({ length: 21 }, (_, i) => `skill-${i}`)
    await expect(
      caller.settings.updateJobSettings({
        jobPostingId: "clxyz1234567890abcdef",
        willingToTrain: items,
      }),
    ).rejects.toThrow()
  })

  it("rejects invalid urgency enum", async () => {
    const caller = await makeEmployerCaller()
    await expect(
      caller.settings.updateJobSettings({
        jobPostingId: "clxyz1234567890abcdef",
        urgency: "SUPER_URGENT" as never,
      }),
    ).rejects.toThrow()
  })
})

// =========================================================================
// Task 2.1: Seeker Settings CRUD
// =========================================================================
describe("getSeekerSettings", () => {
  it("returns null when no settings exist", async () => {
    const caller = await makeSeekerCaller()
    const result = await caller.settings.getSeekerSettings()
    expect(result).toBeNull()
    expect(mockDb.seekerSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seekerId: SEEKER.id } }),
    )
  })

  it("returns settings when they exist", async () => {
    mockDb.seekerSettings.findUnique.mockResolvedValue(SEEKER_SETTINGS_SELECTED)
    const caller = await makeSeekerCaller()
    const result = await caller.settings.getSeekerSettings()

    expect(result).toMatchObject({
      minSalary: 120000,
      dealBreakers: ["No remote"],
      priorities: ["Work-life balance", "Compensation"],
      exclusions: ["BigCorp Inc"],
      customPrompt: "Be assertive on salary",
    })
  })

  it("does not return BYOK fields", async () => {
    mockDb.seekerSettings.findUnique.mockResolvedValue(SEEKER_SETTINGS_SELECTED)
    const caller = await makeSeekerCaller()
    const result = await caller.settings.getSeekerSettings()

    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("byokProvider")
    expect(result).not.toHaveProperty("byokMaskedKey")
  })
})

describe("updateSeekerSettings", () => {
  it("upserts settings by seekerId", async () => {
    const caller = await makeSeekerCaller()
    await caller.settings.updateSeekerSettings({
      minSalary: 150000,
      dealBreakers: ["Relocate"],
      priorities: ["Growth"],
      exclusions: ["BadCo"],
      customPrompt: "Be flexible",
    })

    expect(mockDb.seekerSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seekerId: SEEKER.id },
        create: expect.objectContaining({ seekerId: SEEKER.id, minSalary: 150000 }),
        update: expect.objectContaining({ minSalary: 150000 }),
      }),
    )
  })

  it("accepts salaryRules as JSON object", async () => {
    const caller = await makeSeekerCaller()
    await caller.settings.updateSeekerSettings({
      salaryRules: { type: "firm" },
    })

    expect(mockDb.seekerSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ salaryRules: { type: "firm" } }),
      }),
    )
  })

  it("returns settings without BYOK fields", async () => {
    const caller = await makeSeekerCaller()
    const result = await caller.settings.updateSeekerSettings({ minSalary: 100000 })

    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
  })
})

// =========================================================================
// Task 2.3: Job Settings CRUD
// =========================================================================
describe("getJobSettings", () => {
  it("returns null when no settings exist", async () => {
    const caller = await makeEmployerCaller()
    const result = await caller.settings.getJobSettings({ jobPostingId: "clxyz1234567890abcdef" })
    expect(result).toBeNull()
  })

  it("returns settings when they exist", async () => {
    mockDb.jobSettings.findUnique.mockResolvedValue(JOB_SETTINGS_SELECTED)
    const caller = await makeEmployerCaller()
    const result = await caller.settings.getJobSettings({ jobPostingId: "clxyz1234567890abcdef" })

    expect(result).toMatchObject({
      trueMaxSalary: 180000,
      urgency: "HIGH",
      willingToTrain: ["Kubernetes", "GraphQL"],
      priorityAttrs: ["Culture fit", "Technical depth"],
    })
  })

  it("does not return BYOK fields", async () => {
    mockDb.jobSettings.findUnique.mockResolvedValue(JOB_SETTINGS_SELECTED)
    const caller = await makeEmployerCaller()
    const result = await caller.settings.getJobSettings({ jobPostingId: "clxyz1234567890abcdef" })

    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("byokProvider")
  })

  it("rejects when posting belongs to another employer", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ ...JOB_POSTING, employerId: "emp_other" })
    const caller = await makeEmployerCaller()

    await expect(
      caller.settings.getJobSettings({ jobPostingId: "clxyz1234567890abcdef" }),
    ).rejects.toThrow()
  })

  it("rejects when posting does not exist", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(null)
    const caller = await makeEmployerCaller()

    await expect(
      caller.settings.getJobSettings({ jobPostingId: "jp_nonexistent" }),
    ).rejects.toThrow()
  })
})

describe("updateJobSettings", () => {
  it("upserts settings by jobPostingId", async () => {
    const caller = await makeEmployerCaller()
    await caller.settings.updateJobSettings({
      jobPostingId: "clxyz1234567890abcdef",
      trueMaxSalary: 200000,
      urgency: "CRITICAL",
      willingToTrain: ["Docker"],
      priorityAttrs: ["Speed"],
      customPrompt: "Hire fast",
    })

    expect(mockDb.jobSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobPostingId: "clxyz1234567890abcdef" },
        create: expect.objectContaining({
          jobPostingId: "clxyz1234567890abcdef",
          trueMaxSalary: 200000,
        }),
        update: expect.objectContaining({ trueMaxSalary: 200000 }),
      }),
    )
  })

  it("accepts minQualOverride as JSON object", async () => {
    const caller = await makeEmployerCaller()
    await caller.settings.updateJobSettings({
      jobPostingId: "clxyz1234567890abcdef",
      minQualOverride: { yearsExperience: 2 },
    })

    expect(mockDb.jobSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ minQualOverride: { yearsExperience: 2 } }),
      }),
    )
  })

  it("rejects when posting belongs to another employer", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ ...JOB_POSTING, employerId: "emp_other" })
    const caller = await makeEmployerCaller()

    await expect(
      caller.settings.updateJobSettings({
        jobPostingId: "clxyz1234567890abcdef",
        trueMaxSalary: 200000,
      }),
    ).rejects.toThrow()
  })
})

// =========================================================================
// Task 3.1: Privacy Boundary
// =========================================================================
describe("Privacy boundary enforcement", () => {
  it("seeker cannot access getJobSettings (role mismatch)", async () => {
    const caller = await makeSeekerCaller()
    await expect(
      caller.settings.getJobSettings({ jobPostingId: "clxyz1234567890abcdef" }),
    ).rejects.toThrow()
  })

  it("employer cannot access getSeekerSettings (role mismatch)", async () => {
    // Employer context but calling seeker-only procedure
    const caller = await makeEmployerCaller()
    await expect(caller.settings.getSeekerSettings()).rejects.toThrow()
  })
})
