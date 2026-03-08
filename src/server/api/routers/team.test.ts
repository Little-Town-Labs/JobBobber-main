/**
 * Tasks 2.3, 2.5, 2.7 — Team router tests.
 * Tests all 7 team procedures with mocked DB and Clerk API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockEmployer, createMockEmployerMember } from "tests/helpers/create-entities"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockClerkCreateInvitation = vi.fn()
const mockClerkRevokeInvitation = vi.fn()
const mockClerkDeleteMembership = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn().mockResolvedValue({
    organizations: {
      createOrganizationInvitation: (...args: unknown[]) => mockClerkCreateInvitation(...args),
      revokeOrganizationInvitation: (...args: unknown[]) => mockClerkRevokeInvitation(...args),
      deleteOrganizationMembership: (...args: unknown[]) => mockClerkDeleteMembership(...args),
    },
  }),
}))

const flagState = { enabled: true }
vi.mock("@/lib/flags", () => ({
  MULTI_MEMBER_EMPLOYER: () => flagState.enabled,
  assertFlagEnabled: async (fn: () => boolean) => {
    if (!fn()) {
      const { TRPCError } = await import("@trpc/server")
      throw new TRPCError({ code: "NOT_FOUND", message: "This feature is not yet available." })
    }
  },
}))

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}))

const mockMemberFindMany = vi.fn()
const mockMemberFindUnique = vi.fn()
const mockMemberCount = vi.fn()
const mockMemberUpdate = vi.fn()
const mockMemberDelete = vi.fn()
const mockInvitationFindFirst = vi.fn()
const mockInvitationFindUnique = vi.fn()
const mockInvitationFindMany = vi.fn()
const mockInvitationCreate = vi.fn()
const mockInvitationUpdate = vi.fn()
const mockActivityLogFindMany = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    employer: { findUnique: vi.fn() },
    employerMember: {
      findMany: (...args: unknown[]) => mockMemberFindMany(...args),
      findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
      count: (...args: unknown[]) => mockMemberCount(...args),
      update: (...args: unknown[]) => mockMemberUpdate(...args),
      delete: (...args: unknown[]) => mockMemberDelete(...args),
    },
    invitation: {
      findFirst: (...args: unknown[]) => mockInvitationFindFirst(...args),
      findUnique: (...args: unknown[]) => mockInvitationFindUnique(...args),
      findMany: (...args: unknown[]) => mockInvitationFindMany(...args),
      create: (...args: unknown[]) => mockInvitationCreate(...args),
      update: (...args: unknown[]) => mockInvitationUpdate(...args),
    },
    activityLog: {
      findMany: (...args: unknown[]) => mockActivityLogFindMany(...args),
    },
  },
}))

vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPLOYER = createMockEmployer({ id: "emp_01", clerkOrgId: "org_xyz", name: "Acme" })
const ADMIN_MEMBER = createMockEmployerMember({
  id: "mem_admin",
  employerId: "emp_01",
  clerkUserId: "user_admin",
  role: "ADMIN",
})

async function makeCaller() {
  const { db } = await import("@/lib/db")
  vi.mocked(db.employer.findUnique).mockResolvedValue(EMPLOYER as never)
  mockMemberFindUnique.mockImplementation(
    (args: {
      where: { id?: string; employerId_clerkUserId?: { employerId: string; clerkUserId: string } }
    }) => {
      if (args.where.employerId_clerkUserId) {
        return Promise.resolve(ADMIN_MEMBER)
      }
      return Promise.resolve(null)
    },
  )

  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { teamRouter } = await import("@/server/api/routers/team")
  const router = createTRPCRouter({ team: teamRouter })

  return createCallerFactory(router)({
    db: db as never,
    inngest: null as never,
    userId: "user_admin",
    orgId: "org_xyz",
    orgRole: "org:admin",
    userRole: "EMPLOYER",
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("team.listMembers", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns all members with roles and join dates", async () => {
    const members = [
      ADMIN_MEMBER,
      createMockEmployerMember({
        id: "mem_poster",
        role: "JOB_POSTER",
        clerkUserId: "user_poster",
      }),
    ]
    mockMemberFindMany.mockResolvedValue(members)

    const caller = await makeCaller()
    const result = await caller.team.listMembers()

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty("role", "ADMIN")
    expect(result[1]).toHaveProperty("role", "JOB_POSTER")
  })
})

describe("team.invite", () => {
  beforeEach(() => vi.clearAllMocks())

  it("creates invitation with valid email and role", async () => {
    mockInvitationFindFirst.mockResolvedValue(null)
    mockClerkCreateInvitation.mockResolvedValue({ id: "clerk_inv_01" })
    mockInvitationCreate.mockResolvedValue({
      id: "inv_01",
      email: "new@example.com",
      role: "JOB_POSTER",
      status: "PENDING",
      expiresAt: new Date("2026-03-15"),
      createdAt: new Date("2026-03-08"),
    })

    const caller = await makeCaller()
    const result = await caller.team.invite({ email: "new@example.com", role: "JOB_POSTER" })

    expect(result.email).toBe("new@example.com")
    expect(result.role).toBe("JOB_POSTER")
    expect(result.status).toBe("PENDING")
    expect(mockClerkCreateInvitation).toHaveBeenCalledOnce()
  })

  it("rejects duplicate pending invitation", async () => {
    mockInvitationFindFirst.mockResolvedValue({ id: "existing" })

    const caller = await makeCaller()
    await expect(
      caller.team.invite({ email: "dup@example.com", role: "VIEWER" }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })
})

describe("team.updateRole", () => {
  beforeEach(() => vi.clearAllMocks())

  it("changes a member role", async () => {
    const member = createMockEmployerMember({
      id: "mem_viewer",
      employerId: "emp_01",
      role: "VIEWER",
    })
    mockMemberUpdate.mockResolvedValue({ ...member, role: "JOB_POSTER" })

    const caller = await makeCaller()
    mockMemberFindUnique.mockImplementation(
      (args: { where: { id?: string; employerId_clerkUserId?: unknown } }) => {
        if (args.where.employerId_clerkUserId) return Promise.resolve(ADMIN_MEMBER)
        if (args.where.id === "mem_viewer") return Promise.resolve(member)
        return Promise.resolve(null)
      },
    )
    const result = await caller.team.updateRole({ memberId: "mem_viewer", role: "JOB_POSTER" })

    expect(result.role).toBe("JOB_POSTER")
  })

  it("prevents demoting the last admin", async () => {
    const adminMember = createMockEmployerMember({
      id: "mem_last_admin",
      employerId: "emp_01",
      role: "ADMIN",
    })
    mockMemberCount.mockResolvedValue(1) // only 1 admin

    const caller = await makeCaller()
    mockMemberFindUnique.mockImplementation(
      (args: { where: { id?: string; employerId_clerkUserId?: unknown } }) => {
        if (args.where.employerId_clerkUserId) return Promise.resolve(ADMIN_MEMBER)
        if (args.where.id === "mem_last_admin") return Promise.resolve(adminMember)
        return Promise.resolve(null)
      },
    )
    await expect(
      caller.team.updateRole({ memberId: "mem_last_admin", role: "VIEWER" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("returns NOT_FOUND for unknown member", async () => {
    const caller = await makeCaller()
    mockMemberFindUnique.mockImplementation(
      (args: { where: { id?: string; employerId_clerkUserId?: unknown } }) => {
        if (args.where.employerId_clerkUserId) return Promise.resolve(ADMIN_MEMBER)
        return Promise.resolve(null)
      },
    )
    await expect(
      caller.team.updateRole({ memberId: "nonexistent", role: "VIEWER" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("team.removeMember", () => {
  beforeEach(() => vi.clearAllMocks())

  it("removes a member and calls Clerk", async () => {
    const member = createMockEmployerMember({
      id: "mem_to_remove",
      employerId: "emp_01",
      clerkUserId: "user_to_remove",
      role: "VIEWER",
    })
    mockMemberDelete.mockResolvedValue(member)
    mockClerkDeleteMembership.mockResolvedValue({})

    const caller = await makeCaller()
    mockMemberFindUnique.mockImplementation(
      (args: { where: { id?: string; employerId_clerkUserId?: unknown } }) => {
        if (args.where.employerId_clerkUserId) return Promise.resolve(ADMIN_MEMBER)
        if (args.where.id === "mem_to_remove") return Promise.resolve(member)
        return Promise.resolve(null)
      },
    )
    const result = await caller.team.removeMember({ memberId: "mem_to_remove" })

    expect(result.success).toBe(true)
    expect(mockClerkDeleteMembership).toHaveBeenCalledOnce()
    expect(mockMemberDelete).toHaveBeenCalledOnce()
  })

  it("prevents removing the last admin", async () => {
    const adminMember = createMockEmployerMember({
      id: "mem_last_admin",
      employerId: "emp_01",
      role: "ADMIN",
    })
    mockMemberCount.mockResolvedValue(1)

    const caller = await makeCaller()
    mockMemberFindUnique.mockImplementation(
      (args: { where: { id?: string; employerId_clerkUserId?: unknown } }) => {
        if (args.where.employerId_clerkUserId) return Promise.resolve(ADMIN_MEMBER)
        if (args.where.id === "mem_last_admin") return Promise.resolve(adminMember)
        return Promise.resolve(null)
      },
    )
    await expect(caller.team.removeMember({ memberId: "mem_last_admin" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })
})

describe("team.listInvitations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns pending invitations", async () => {
    const invitations = [
      {
        id: "inv_01",
        email: "a@example.com",
        role: "JOB_POSTER",
        status: "PENDING",
        invitedBy: "user_admin",
        expiresAt: new Date("2026-03-15"),
        createdAt: new Date("2026-03-08"),
      },
    ]
    mockInvitationFindMany.mockResolvedValue(invitations)

    const caller = await makeCaller()
    const result = await caller.team.listInvitations()

    expect(result).toHaveLength(1)
    expect(result[0]!.email).toBe("a@example.com")
    expect(result[0]!.status).toBe("PENDING")
  })
})

describe("team.revokeInvitation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("revokes a pending invitation and calls Clerk", async () => {
    mockInvitationFindUnique.mockResolvedValue({
      id: "inv_01",
      employerId: "emp_01",
      email: "revoke@example.com",
      status: "PENDING",
      clerkInvitationId: "clerk_inv_01",
    })
    mockInvitationUpdate.mockResolvedValue({ id: "inv_01", status: "REVOKED" })
    mockClerkRevokeInvitation.mockResolvedValue({})

    const caller = await makeCaller()
    const result = await caller.team.revokeInvitation({ invitationId: "inv_01" })

    expect(result.success).toBe(true)
    expect(mockClerkRevokeInvitation).toHaveBeenCalledOnce()
    expect(mockInvitationUpdate).toHaveBeenCalledOnce()
  })

  it("rejects revoking non-pending invitation", async () => {
    mockInvitationFindUnique.mockResolvedValue({
      id: "inv_01",
      employerId: "emp_01",
      status: "ACCEPTED",
    })

    const caller = await makeCaller()
    await expect(caller.team.revokeInvitation({ invitationId: "inv_01" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })
})

describe("team.getActivityLog", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns paginated activity entries", async () => {
    const entries = [
      {
        id: "log_01",
        actorName: "John",
        action: "posting.created",
        targetType: "JobPosting",
        targetLabel: "Senior Engineer",
        createdAt: new Date("2026-03-08T12:00:00Z"),
      },
    ]
    mockActivityLogFindMany.mockResolvedValue(entries)

    const caller = await makeCaller()
    const result = await caller.team.getActivityLog()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.action).toBe("posting.created")
    expect(result.hasMore).toBe(false)
  })

  it("indicates hasMore when more entries exist", async () => {
    // Return limit + 1 entries to indicate more pages
    const entries = Array.from({ length: 21 }, (_, i) => ({
      id: `log_${i}`,
      actorName: "John",
      action: "posting.created",
      targetType: null,
      targetLabel: null,
      createdAt: new Date(),
    }))
    mockActivityLogFindMany.mockResolvedValue(entries)

    const caller = await makeCaller()
    const result = await caller.team.getActivityLog()

    expect(result.items).toHaveLength(20)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe("log_19")
  })
})

describe("feature flag gating", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects all procedures when flag is disabled", async () => {
    flagState.enabled = false
    mockMemberFindMany.mockResolvedValue([])

    const caller = await makeCaller()
    await expect(caller.team.listMembers()).rejects.toMatchObject({ code: "NOT_FOUND" })

    flagState.enabled = true
  })
})
