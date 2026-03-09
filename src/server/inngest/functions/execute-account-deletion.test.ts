/**
 * Feature 18 — Account deletion Inngest function tests.
 * Tests the extracted executeAccountDeletion logic for testability.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDeletionRequestFindUnique = vi.fn()
const mockDeletionRequestUpdate = vi.fn()
const mockConversationUpdateMany = vi.fn()
const mockJobPostingUpdateMany = vi.fn()
const mockJobSeekerDelete = vi.fn()
const mockEmployerDelete = vi.fn()
const mockAuditLogCreate = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    deletionRequest: {
      findUnique: (...args: unknown[]) => mockDeletionRequestFindUnique(...args),
      update: (...args: unknown[]) => mockDeletionRequestUpdate(...args),
    },
    agentConversation: {
      updateMany: (...args: unknown[]) => mockConversationUpdateMany(...args),
    },
    jobPosting: {
      updateMany: (...args: unknown[]) => mockJobPostingUpdateMany(...args),
    },
    jobSeeker: {
      delete: (...args: unknown[]) => mockJobSeekerDelete(...args),
    },
    employer: {
      delete: (...args: unknown[]) => mockEmployerDelete(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}))

const mockClerkDeleteUser = vi.fn()
const mockClerkDeleteOrg = vi.fn()
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: { deleteUser: (...args: unknown[]) => mockClerkDeleteUser(...args) },
    organizations: { deleteOrganization: (...args: unknown[]) => mockClerkDeleteOrg(...args) },
  }),
}))

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_opts: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}))

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { executeAccountDeletionHandler } from "./execute-account-deletion"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeletionRequest(overrides?: Record<string, unknown>) {
  return {
    id: "del_01",
    clerkUserId: "user_01",
    userType: "JOB_SEEKER",
    status: "PENDING",
    reason: "Moving on",
    scheduledAt: new Date("2026-03-12T12:00:00Z"),
    requestedAt: new Date("2026-03-09T12:00:00Z"),
    executedAt: null,
    inngestEventId: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("executeAccountDeletionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips if deletion request is CANCELLED", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest({ status: "CANCELLED" }))

    const result = await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    expect(result).toEqual({ skipped: true, reason: "request_cancelled" })
    expect(mockDeletionRequestUpdate).not.toHaveBeenCalled()
    expect(mockJobSeekerDelete).not.toHaveBeenCalled()
  })

  it("skips if deletion request not found", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(null)

    const result = await executeAccountDeletionHandler({
      deletionRequestId: "del_nonexistent",
      clerkUserId: "user_01",
    })

    expect(result).toEqual({ skipped: true, reason: "request_not_found" })
  })

  it("sets status to EXECUTING before processing", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest())
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 0 })
    mockJobSeekerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    // First update call should set EXECUTING
    expect(mockDeletionRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "del_01" },
        data: { status: "EXECUTING" },
      }),
    )
  })

  it("terminates active conversations for seeker", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest())
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 2 })
    mockJobSeekerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    expect(mockConversationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seeker: { clerkUserId: "user_01" },
          status: "IN_PROGRESS",
        }),
        data: { status: "TERMINATED" },
      }),
    )
  })

  it("closes active job postings for employer", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest({ userType: "EMPLOYER" }))
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 0 })
    mockJobPostingUpdateMany.mockResolvedValue({ count: 3 })
    mockEmployerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})
    mockClerkDeleteOrg.mockResolvedValue({})

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
      clerkOrgId: "org_01",
    })

    expect(mockJobPostingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employer: { clerkOrgId: "org_01" },
          status: { in: ["ACTIVE", "PAUSED", "DRAFT"] },
        }),
        data: { status: "CLOSED" },
      }),
    )
  })

  it("deletes JobSeeker record for seeker type", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest())
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 0 })
    mockJobSeekerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    expect(mockJobSeekerDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: "user_01" },
      }),
    )
    expect(mockEmployerDelete).not.toHaveBeenCalled()
  })

  it("deletes Employer record for employer type", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest({ userType: "EMPLOYER" }))
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 0 })
    mockJobPostingUpdateMany.mockResolvedValue({ count: 0 })
    mockEmployerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})
    mockClerkDeleteOrg.mockResolvedValue({})

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
      clerkOrgId: "org_01",
    })

    expect(mockEmployerDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkOrgId: "org_01" },
      }),
    )
    expect(mockJobSeekerDelete).not.toHaveBeenCalled()
  })

  it("deletes Clerk user account", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest())
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 0 })
    mockJobSeekerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    expect(mockClerkDeleteUser).toHaveBeenCalledWith("user_01")
  })

  it("sets status to COMPLETED on success", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest())
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 0 })
    mockJobSeekerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    // Last update call should set COMPLETED
    const updateCalls = mockDeletionRequestUpdate.mock.calls
    const lastCall = updateCalls[updateCalls.length - 1]
    expect(lastCall[0]).toEqual(
      expect.objectContaining({
        where: { id: "del_01" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    )
  })

  it("sets status to FAILED on error", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest())
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockRejectedValue(new Error("DB connection lost"))

    const result = await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    expect(result).toEqual(expect.objectContaining({ failed: true }))

    // Should have been called with FAILED status
    expect(mockDeletionRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "del_01" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    )
  })

  it("logs audit with SYSTEM actor on completion", async () => {
    mockDeletionRequestFindUnique.mockResolvedValue(makeDeletionRequest())
    mockDeletionRequestUpdate.mockResolvedValue({})
    mockConversationUpdateMany.mockResolvedValue({ count: 0 })
    mockJobSeekerDelete.mockResolvedValue({})
    mockClerkDeleteUser.mockResolvedValue({})

    const { logAudit } = await import("@/lib/audit")

    await executeAccountDeletionHandler({
      deletionRequestId: "del_01",
      clerkUserId: "user_01",
    })

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "SYSTEM",
        actorType: "SYSTEM",
        action: "account.deletion.completed",
        entityType: "DeletionRequest",
        entityId: "del_01",
        result: "SUCCESS",
      }),
    )
  })
})
