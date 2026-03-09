/**
 * Feature 18 — Compliance router tests.
 * Tests export, deletion, audit log, and MFA stub procedures.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))

const mockAuditLogCreate = vi.fn()
const mockAuditLogFindMany = vi.fn()
const mockDeletionRequestFindUnique = vi.fn()
const mockDeletionRequestCreate = vi.fn()
const mockDeletionRequestUpdate = vi.fn()
const mockJobSeekerFindUnique = vi.fn()
const mockSeekerSettingsFindUnique = vi.fn()
const mockMatchFindMany = vi.fn()
const mockConversationFindMany = vi.fn()
const mockFeedbackFindUnique = vi.fn()
const mockEmployerFindUnique = vi.fn()
const mockJobPostingFindMany = vi.fn()
const mockInngestSend = vi.fn()
const mockEmployerMemberFindUnique = vi.fn()
const mockEmployerMemberFindMany = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
    },
    deletionRequest: {
      findUnique: (...args: unknown[]) => mockDeletionRequestFindUnique(...args),
      create: (...args: unknown[]) => mockDeletionRequestCreate(...args),
      update: (...args: unknown[]) => mockDeletionRequestUpdate(...args),
    },
    jobSeeker: { findUnique: (...args: unknown[]) => mockJobSeekerFindUnique(...args) },
    seekerSettings: { findUnique: (...args: unknown[]) => mockSeekerSettingsFindUnique(...args) },
    employer: { findUnique: (...args: unknown[]) => mockEmployerFindUnique(...args) },
    employerMember: {
      findUnique: (...args: unknown[]) => mockEmployerMemberFindUnique(...args),
      findMany: (...args: unknown[]) => mockEmployerMemberFindMany(...args),
    },
    jobPosting: { findMany: (...args: unknown[]) => mockJobPostingFindMany(...args) },
    match: { findMany: (...args: unknown[]) => mockMatchFindMany(...args) },
    agentConversation: { findMany: (...args: unknown[]) => mockConversationFindMany(...args) },
    feedbackInsights: { findUnique: (...args: unknown[]) => mockFeedbackFindUnique(...args) },
  },
}))

const flagState = { enabled: true }
vi.mock("@/lib/flags", () => ({
  COMPLIANCE_SECURITY: () => flagState.enabled,
  assertFlagEnabled: async (fn: () => boolean) => {
    if (!fn()) {
      const { TRPCError } = await import("@trpc/server")
      throw new TRPCError({ code: "NOT_FOUND", message: "This feature is not yet available." })
    }
  },
}))

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}))

vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-03-09T12:00:00Z")

// Construct mock db directly to avoid globalThis Prisma singleton pollution
// when running alongside other test files in the same vitest worker
const mockDb = {
  auditLog: {
    create: (...args: unknown[]) => mockAuditLogCreate(...args),
    findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
  },
  deletionRequest: {
    findUnique: (...args: unknown[]) => mockDeletionRequestFindUnique(...args),
    create: (...args: unknown[]) => mockDeletionRequestCreate(...args),
    update: (...args: unknown[]) => mockDeletionRequestUpdate(...args),
  },
  jobSeeker: { findUnique: (...args: unknown[]) => mockJobSeekerFindUnique(...args) },
  seekerSettings: { findUnique: (...args: unknown[]) => mockSeekerSettingsFindUnique(...args) },
  employer: { findUnique: (...args: unknown[]) => mockEmployerFindUnique(...args) },
  employerMember: {
    findUnique: (...args: unknown[]) => mockEmployerMemberFindUnique(...args),
    findMany: (...args: unknown[]) => mockEmployerMemberFindMany(...args),
  },
  jobPosting: { findMany: (...args: unknown[]) => mockJobPostingFindMany(...args) },
  match: { findMany: (...args: unknown[]) => mockMatchFindMany(...args) },
  agentConversation: { findMany: (...args: unknown[]) => mockConversationFindMany(...args) },
  feedbackInsights: { findUnique: (...args: unknown[]) => mockFeedbackFindUnique(...args) },
}

// Pre-load tRPC and compliance modules once. When vitest batches 30+ test files
// in one worker, dynamic imports can take 30s+ due to module loading contention.
// Using beforeAll with a generous timeout ensures modules are ready before tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _createCallerFactory: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _createTRPCRouter: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _complianceRouter: any

beforeAll(async () => {
  const trpc = await import("@/server/api/trpc")
  const compliance = await import("@/server/api/routers/compliance")
  _createCallerFactory = trpc.createCallerFactory
  _createTRPCRouter = trpc.createTRPCRouter
  _complianceRouter = compliance.complianceRouter
}, 60_000)

function makeSeekerCaller() {
  const router = _createTRPCRouter({ compliance: _complianceRouter })

  return _createCallerFactory(router)({
    db: mockDb as never,
    inngest: { send: mockInngestSend } as never,
    userId: "user_seeker_01",
    orgId: null,
    orgRole: null,
    userRole: "JOB_SEEKER",
  })
}

function makeEmployerCaller() {
  // adminProcedure requires employer + member middleware
  const employer = {
    id: "emp_01",
    clerkOrgId: "org_xyz",
    name: "Acme",
    dataUsageOptOut: false,
  }
  const member = {
    id: "mem_admin",
    employerId: "emp_01",
    clerkUserId: "user_employer_01",
    role: "ADMIN",
  }

  mockEmployerFindUnique.mockResolvedValue(employer)
  mockEmployerMemberFindMany.mockResolvedValue([{ clerkUserId: "user_employer_01" }])
  mockEmployerMemberFindUnique.mockImplementation(
    (args: {
      where: { id?: string; employerId_clerkUserId?: { employerId: string; clerkUserId: string } }
    }) => {
      if (args.where.employerId_clerkUserId) {
        return Promise.resolve(member)
      }
      return Promise.resolve(null)
    },
  )

  const router = _createTRPCRouter({ compliance: _complianceRouter })

  return _createCallerFactory(router)({
    db: mockDb as never,
    inngest: { send: mockInngestSend } as never,
    userId: "user_employer_01",
    orgId: "org_xyz",
    orgRole: "org:admin",
    userRole: "EMPLOYER",
  })
}

// ---------------------------------------------------------------------------
// Tests — exportMyData (seeker)
// ---------------------------------------------------------------------------

describe("compliance.exportMyData (seeker)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns profile, settings, matches, conversations, and feedback", async () => {
    const seekerProfile = {
      id: "seeker_01",
      clerkUserId: "user_seeker_01",
      name: "Jane Doe",
      headline: "Engineer",
      bio: "Hello",
      skills: ["TypeScript"],
      location: "NYC",
      createdAt: NOW,
      updatedAt: NOW,
    }
    const settings = {
      id: "ss_01",
      seekerId: "seeker_01",
      minSalary: 100000,
      dealBreakers: ["no remote"],
      priorities: ["work-life balance"],
      customPrompt: null,
      dataUsageOptOut: false,
      byokApiKeyEncrypted: "encrypted-key-secret",
      byokProvider: "openai",
    }
    const matches = [
      {
        id: "match_01",
        confidenceScore: "GOOD",
        matchSummary: "Good match",
        seekerStatus: "PENDING",
        employerStatus: "PENDING",
        createdAt: NOW,
      },
    ]
    const conversations = [
      {
        id: "conv_01",
        status: "COMPLETED_MATCH",
        messages: [{ role: "seeker_agent", content: "Hello" }],
        startedAt: NOW,
        completedAt: NOW,
      },
    ]
    const feedback = {
      id: "fb_01",
      strengths: ["communication"],
      weaknesses: ["experience"],
      recommendations: ["upskill"],
      matchRate: 0.75,
    }

    mockJobSeekerFindUnique.mockResolvedValue(seekerProfile)
    mockSeekerSettingsFindUnique.mockResolvedValue(settings)
    mockMatchFindMany.mockResolvedValue(matches)
    mockConversationFindMany.mockResolvedValue(conversations)
    mockFeedbackFindUnique.mockResolvedValue(feedback)

    const caller = await makeSeekerCaller()
    const result = await caller.compliance.exportMyData()

    expect(result.userType).toBe("JOB_SEEKER")
    expect(result.profile).toEqual(seekerProfile)
    expect(result.settings).toBeDefined()
    // byokApiKeyEncrypted must be excluded
    expect(result.settings).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result.matches).toHaveLength(1)
    expect(result.conversations).toHaveLength(1)
    expect(result.feedbackInsights).toEqual(feedback)
    expect(result.exportedAt).toBeDefined()
  })

  it("excludes byokApiKeyEncrypted from settings", async () => {
    const seekerProfile = {
      id: "seeker_01",
      clerkUserId: "user_seeker_01",
      name: "Jane",
    }
    const settings = {
      id: "ss_01",
      seekerId: "seeker_01",
      minSalary: 80000,
      byokApiKeyEncrypted: "super-secret-key",
      byokProvider: "openai",
      dataUsageOptOut: false,
    }

    mockJobSeekerFindUnique.mockResolvedValue(seekerProfile)
    mockSeekerSettingsFindUnique.mockResolvedValue(settings)
    mockMatchFindMany.mockResolvedValue([])
    mockConversationFindMany.mockResolvedValue([])
    mockFeedbackFindUnique.mockResolvedValue(null)

    const caller = await makeSeekerCaller()
    const result = await caller.compliance.exportMyData()

    expect(result.settings).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result.settings).toHaveProperty("byokProvider", "openai")
  })

  it("logs audit event on export", async () => {
    mockJobSeekerFindUnique.mockResolvedValue({ id: "seeker_01", clerkUserId: "user_seeker_01" })
    mockSeekerSettingsFindUnique.mockResolvedValue(null)
    mockMatchFindMany.mockResolvedValue([])
    mockConversationFindMany.mockResolvedValue([])
    mockFeedbackFindUnique.mockResolvedValue(null)

    const { logAudit } = await import("@/lib/audit")
    const caller = await makeSeekerCaller()
    await caller.compliance.exportMyData()

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user_seeker_01",
        actorType: "JOB_SEEKER",
        action: "data.exported",
        result: "SUCCESS",
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — exportMyData (employer)
// ---------------------------------------------------------------------------

describe("compliance.exportMyData (employer)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns company profile, job postings, matches, and conversations", async () => {
    const employer = {
      id: "emp_01",
      clerkOrgId: "org_xyz",
      name: "Acme",
      industry: "Tech",
      byokApiKeyEncrypted: "encrypted-secret",
      byokProvider: "openai",
      dataUsageOptOut: false,
    }
    const postings = [
      {
        id: "jp_01",
        title: "Engineer",
        status: "ACTIVE",
        settings: { customPrompt: "test", byokApiKeyEncrypted: "secret" },
      },
    ]
    const matches = [{ id: "match_01", confidenceScore: "STRONG", matchSummary: "Great fit" }]
    const conversations = [
      {
        id: "conv_01",
        status: "COMPLETED_MATCH",
        messages: [{ role: "employer_agent", content: "Hi" }],
      },
    ]
    const feedback = { id: "fb_01", strengths: ["culture"], matchRate: 0.9 }

    mockEmployerFindUnique.mockResolvedValue(employer)
    mockJobPostingFindMany.mockResolvedValue(postings)
    mockMatchFindMany.mockResolvedValue(matches)
    mockConversationFindMany.mockResolvedValue(conversations)
    mockFeedbackFindUnique.mockResolvedValue(feedback)

    const caller = await makeEmployerCaller()
    const result = await caller.compliance.exportMyData()

    expect(result.userType).toBe("EMPLOYER")
    expect(result.profile).toBeDefined()
    // byokApiKeyEncrypted must be excluded from profile
    expect(result.profile).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result.jobPostings).toHaveLength(1)
    expect(result.matches).toHaveLength(1)
    expect(result.conversations).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Tests — requestDeletion
// ---------------------------------------------------------------------------

describe("compliance.requestDeletion", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates DeletionRequest with PENDING status and 72h scheduledAt", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(null)
    const created = {
      id: "del_01",
      clerkUserId: "user_seeker_01",
      userType: "JOB_SEEKER",
      status: "PENDING",
      reason: "Moving on",
      scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      requestedAt: NOW,
    }
    mockDeletionRequestCreate.mockResolvedValue(created)
    mockInngestSend.mockResolvedValue(undefined)

    const caller = await makeSeekerCaller()
    const result = await caller.compliance.requestDeletion({
      confirmation: "DELETE MY ACCOUNT",
      reason: "Moving on",
    })

    expect(result.status).toBe("PENDING")
    expect(mockDeletionRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkUserId: "user_seeker_01",
          userType: "JOB_SEEKER",
          status: "PENDING",
        }),
      }),
    )
  })

  it("rejects with BAD_REQUEST if confirmation does not match", async () => {
    const caller = await makeSeekerCaller()
    await expect(
      caller.compliance.requestDeletion({
        confirmation: "wrong text",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects with CONFLICT if deletion already pending", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue({
      id: "del_existing",
      status: "PENDING",
    })

    const caller = await makeSeekerCaller()
    await expect(
      caller.compliance.requestDeletion({
        confirmation: "DELETE MY ACCOUNT",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("sends Inngest event for scheduled deletion", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(null)
    const scheduledAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
    mockDeletionRequestCreate.mockResolvedValue({
      id: "del_01",
      clerkUserId: "user_seeker_01",
      userType: "JOB_SEEKER",
      status: "PENDING",
      scheduledAt,
    })
    mockInngestSend.mockResolvedValue(undefined)

    const caller = await makeSeekerCaller()
    await caller.compliance.requestDeletion({ confirmation: "DELETE MY ACCOUNT" })

    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "compliance/account.deletion.execute",
        data: expect.objectContaining({
          deletionRequestId: "del_01",
          clerkUserId: "user_seeker_01",
          clerkOrgId: null,
        }),
      }),
    )
  })

  it("logs audit event", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(null)
    mockDeletionRequestCreate.mockResolvedValue({
      id: "del_01",
      clerkUserId: "user_seeker_01",
      userType: "JOB_SEEKER",
      status: "PENDING",
      scheduledAt: new Date(),
    })
    mockInngestSend.mockResolvedValue(undefined)

    const { logAudit } = await import("@/lib/audit")
    const caller = await makeSeekerCaller()
    await caller.compliance.requestDeletion({ confirmation: "DELETE MY ACCOUNT" })

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user_seeker_01",
        action: "account.deletion.requested",
        result: "SUCCESS",
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — cancelDeletion
// ---------------------------------------------------------------------------

describe("compliance.cancelDeletion", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates status to CANCELLED", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue({
      id: "del_01",
      clerkUserId: "user_seeker_01",
      status: "PENDING",
    })
    mockDeletionRequestUpdate.mockResolvedValue({
      id: "del_01",
      status: "CANCELLED",
    })

    const caller = await makeSeekerCaller()
    const result = await caller.compliance.cancelDeletion()

    expect(result.status).toBe("CANCELLED")
    expect(mockDeletionRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: "user_seeker_01" },
        data: { status: "CANCELLED" },
      }),
    )
  })

  it("returns NOT_FOUND if no pending deletion", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(null)

    const caller = await makeSeekerCaller()
    await expect(caller.compliance.cancelDeletion()).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("logs audit event", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue({
      id: "del_01",
      clerkUserId: "user_seeker_01",
      status: "PENDING",
    })
    mockDeletionRequestUpdate.mockResolvedValue({ id: "del_01", status: "CANCELLED" })

    const { logAudit } = await import("@/lib/audit")
    const caller = await makeSeekerCaller()
    await caller.compliance.cancelDeletion()

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user_seeker_01",
        action: "account.deletion.cancelled",
        result: "SUCCESS",
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — getDeletionStatus
// ---------------------------------------------------------------------------

describe("compliance.getDeletionStatus", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns hasPendingDeletion: true with request details", async () => {
    const scheduledAt = new Date("2026-03-12T12:00:00Z")
    mockDeletionRequestFindUnique.mockResolvedValue({
      id: "del_01",
      status: "PENDING",
      scheduledAt,
      requestedAt: NOW,
      reason: "Leaving",
    })

    const caller = await makeSeekerCaller()
    const result = await caller.compliance.getDeletionStatus()

    expect(result.hasPendingDeletion).toBe(true)
    expect(result.request).toBeDefined()
    expect(result.request!.status).toBe("PENDING")
    expect(result.request!.scheduledAt).toBe(scheduledAt.toISOString())
  })

  it("returns hasPendingDeletion: false when no request", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(null)

    const caller = await makeSeekerCaller()
    const result = await caller.compliance.getDeletionStatus()

    expect(result.hasPendingDeletion).toBe(false)
    expect(result.request).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests — getAuditLog (admin)
// ---------------------------------------------------------------------------

describe("compliance.getAuditLog", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns paginated entries", async () => {
    const entries = [
      {
        id: "audit_01",
        actorId: "user_01",
        actorType: "JOB_SEEKER",
        action: "data.exported",
        entityType: null,
        entityId: null,
        metadata: {},
        result: "SUCCESS",
        createdAt: NOW,
      },
    ]
    mockAuditLogFindMany.mockResolvedValue(entries)

    const caller = await makeEmployerCaller()
    const result = await caller.compliance.getAuditLog()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.action).toBe("data.exported")
    expect(result.hasMore).toBe(false)
  })

  it("indicates hasMore when more entries exist", async () => {
    const entries = Array.from({ length: 21 }, (_, i) => ({
      id: `audit_${i}`,
      actorId: "user_01",
      actorType: "JOB_SEEKER",
      action: "data.exported",
      entityType: null,
      entityId: null,
      metadata: {},
      result: "SUCCESS",
      createdAt: NOW,
    }))
    mockAuditLogFindMany.mockResolvedValue(entries)

    const caller = await makeEmployerCaller()
    const result = await caller.compliance.getAuditLog()

    expect(result.items).toHaveLength(20)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe("audit_19")
  })

  it("filters by action", async () => {
    mockAuditLogFindMany.mockResolvedValue([])

    const caller = await makeEmployerCaller()
    await caller.compliance.getAuditLog({ action: "data.exported" })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: "data.exported",
        }),
      }),
    )
  })

  it("filters by date range", async () => {
    mockAuditLogFindMany.mockResolvedValue([])

    const dateFrom = "2026-03-01T00:00:00Z"
    const dateTo = "2026-03-09T23:59:59Z"

    const caller = await makeEmployerCaller()
    await caller.compliance.getAuditLog({ dateFrom, dateTo })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date(dateFrom),
            lte: new Date(dateTo),
          },
        }),
      }),
    )
  })

  it("filters by actorId", async () => {
    mockAuditLogFindMany.mockResolvedValue([])

    const caller = await makeEmployerCaller()
    await caller.compliance.getAuditLog({ actorId: "user_seeker_01" })

    expect(mockAuditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorId: "user_seeker_01",
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Tests — MFA stubs
// ---------------------------------------------------------------------------

describe("compliance.getMfaStatus", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns stub MFA status", async () => {
    const caller = await makeSeekerCaller()
    const result = await caller.compliance.getMfaStatus()

    expect(result.mfaEnabled).toBe(false)
    expect(result.mfaDismissedAt).toBeNull()
    expect(result.shouldPrompt).toBe(true)
  })
})

describe("compliance.dismissMfaPrompt", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns dismissed: true", async () => {
    const caller = await makeSeekerCaller()
    const result = await caller.compliance.dismissMfaPrompt()

    expect(result.dismissed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests — Feature flag gating
// ---------------------------------------------------------------------------

describe("feature flag gating", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects all procedures when flag is disabled", async () => {
    flagState.enabled = false

    const caller = await makeSeekerCaller()
    await expect(caller.compliance.exportMyData()).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(
      caller.compliance.requestDeletion({ confirmation: "DELETE MY ACCOUNT" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(caller.compliance.getDeletionStatus()).rejects.toMatchObject({ code: "NOT_FOUND" })
    await expect(caller.compliance.getMfaStatus()).rejects.toMatchObject({ code: "NOT_FOUND" })

    flagState.enabled = true
  })
})
