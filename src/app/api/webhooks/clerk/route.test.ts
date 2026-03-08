/**
 * Task 3.1 — Clerk webhook handler tests for membership events.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockJobSeekerUpsert = vi.fn()
const mockEmployerUpsert = vi.fn()
const mockEmployerFindUnique = vi.fn()
const mockMemberUpsert = vi.fn()
const mockMemberDeleteMany = vi.fn()
const mockInvitationUpdateMany = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    jobSeeker: { upsert: (...args: unknown[]) => mockJobSeekerUpsert(...args) },
    employer: {
      upsert: (...args: unknown[]) => mockEmployerUpsert(...args),
      findUnique: (...args: unknown[]) => mockEmployerFindUnique(...args),
    },
    employerMember: {
      upsert: (...args: unknown[]) => mockMemberUpsert(...args),
      deleteMany: (...args: unknown[]) => mockMemberDeleteMany(...args),
    },
    invitation: {
      updateMany: (...args: unknown[]) => mockInvitationUpdateMany(...args),
    },
  },
}))

vi.mock("server-only", () => ({}))

// Mock svix Webhook to skip signature verification in tests
const mockVerify = vi.fn()
vi.mock("svix", () => ({
  Webhook: class {
    verify(...args: unknown[]) {
      return mockVerify(...args)
    }
  },
}))

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => {
      const map: Record<string, string> = {
        "svix-id": "test-id",
        "svix-timestamp": "1234567890",
        "svix-signature": "test-sig",
      }
      return map[name] ?? null
    },
  }),
}))

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { POST } from "./route"

function makeRequest(body: string): Request {
  return new Request("https://example.com/api/webhooks/clerk", {
    method: "POST",
    body,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Clerk webhook — organizationMembership.created", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env["CLERK_WEBHOOK_SECRET"] = "test-secret"
  })

  it("creates EmployerMember record via upsert", async () => {
    const event = {
      type: "organizationMembership.created",
      data: {
        organization: { id: "org_abc" },
        public_user_data: { user_id: "user_new" },
        role: "org:member",
      },
    }
    mockVerify.mockReturnValue(event)
    mockEmployerFindUnique.mockResolvedValue({ id: "emp_01" })
    mockMemberUpsert.mockResolvedValue({})

    const res = await POST(makeRequest(JSON.stringify(event)))
    expect(res.status).toBe(200)
    expect(mockMemberUpsert).toHaveBeenCalledOnce()
    const upsertArgs = mockMemberUpsert.mock.calls[0][0]
    expect(upsertArgs.where.employerId_clerkUserId).toEqual({
      employerId: "emp_01",
      clerkUserId: "user_new",
    })
    expect(upsertArgs.create.role).toBe("VIEWER")
  })

  it("maps org:admin role to ADMIN", async () => {
    const event = {
      type: "organizationMembership.created",
      data: {
        organization: { id: "org_abc" },
        public_user_data: { user_id: "user_admin" },
        role: "org:admin",
      },
    }
    mockVerify.mockReturnValue(event)
    mockEmployerFindUnique.mockResolvedValue({ id: "emp_01" })
    mockMemberUpsert.mockResolvedValue({})

    await POST(makeRequest(JSON.stringify(event)))
    const upsertArgs = mockMemberUpsert.mock.calls[0][0]
    expect(upsertArgs.create.role).toBe("ADMIN")
  })

  it("is idempotent (upsert does not fail on duplicate)", async () => {
    const event = {
      type: "organizationMembership.created",
      data: {
        organization: { id: "org_abc" },
        public_user_data: { user_id: "user_existing" },
        role: "org:member",
      },
    }
    mockVerify.mockReturnValue(event)
    mockEmployerFindUnique.mockResolvedValue({ id: "emp_01" })
    mockMemberUpsert.mockResolvedValue({})

    const res = await POST(makeRequest(JSON.stringify(event)))
    expect(res.status).toBe(200)
  })

  it("returns 200 if employer not found (no-op)", async () => {
    const event = {
      type: "organizationMembership.created",
      data: {
        organization: { id: "org_unknown" },
        public_user_data: { user_id: "user_x" },
        role: "org:member",
      },
    }
    mockVerify.mockReturnValue(event)
    mockEmployerFindUnique.mockResolvedValue(null)

    const res = await POST(makeRequest(JSON.stringify(event)))
    expect(res.status).toBe(200)
    expect(mockMemberUpsert).not.toHaveBeenCalled()
  })
})

describe("Clerk webhook — organizationMembership.deleted", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env["CLERK_WEBHOOK_SECRET"] = "test-secret"
  })

  it("deletes EmployerMember record", async () => {
    const event = {
      type: "organizationMembership.deleted",
      data: {
        organization: { id: "org_abc" },
        public_user_data: { user_id: "user_removed" },
      },
    }
    mockVerify.mockReturnValue(event)
    mockEmployerFindUnique.mockResolvedValue({ id: "emp_01" })
    mockMemberDeleteMany.mockResolvedValue({ count: 1 })

    const res = await POST(makeRequest(JSON.stringify(event)))
    expect(res.status).toBe(200)
    expect(mockMemberDeleteMany).toHaveBeenCalledOnce()
    const deleteArgs = mockMemberDeleteMany.mock.calls[0][0]
    expect(deleteArgs.where).toEqual({
      employerId: "emp_01",
      clerkUserId: "user_removed",
    })
  })

  it("is a no-op if record does not exist", async () => {
    const event = {
      type: "organizationMembership.deleted",
      data: {
        organization: { id: "org_abc" },
        public_user_data: { user_id: "user_nonexistent" },
      },
    }
    mockVerify.mockReturnValue(event)
    mockEmployerFindUnique.mockResolvedValue({ id: "emp_01" })
    mockMemberDeleteMany.mockResolvedValue({ count: 0 })

    const res = await POST(makeRequest(JSON.stringify(event)))
    expect(res.status).toBe(200)
  })
})

describe("Clerk webhook — organizationInvitation.accepted", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env["CLERK_WEBHOOK_SECRET"] = "test-secret"
  })

  it("updates Invitation status to ACCEPTED", async () => {
    const event = {
      type: "organizationInvitation.accepted",
      data: {
        id: "clerk_inv_01",
        organization: { id: "org_abc" },
        email_address: "accepted@example.com",
      },
    }
    mockVerify.mockReturnValue(event)
    mockEmployerFindUnique.mockResolvedValue({ id: "emp_01" })
    mockInvitationUpdateMany.mockResolvedValue({ count: 1 })

    const res = await POST(makeRequest(JSON.stringify(event)))
    expect(res.status).toBe(200)
    expect(mockInvitationUpdateMany).toHaveBeenCalledOnce()
    const updateArgs = mockInvitationUpdateMany.mock.calls[0][0]
    expect(updateArgs.where.clerkInvitationId).toBe("clerk_inv_01")
    expect(updateArgs.data.status).toBe("ACCEPTED")
  })
})

describe("Clerk webhook — unknown events", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env["CLERK_WEBHOOK_SECRET"] = "test-secret"
  })

  it("acknowledges unknown events with 200", async () => {
    const event = { type: "some.unknown.event", data: {} }
    mockVerify.mockReturnValue(event)

    const res = await POST(makeRequest(JSON.stringify(event)))
    expect(res.status).toBe(200)
  })
})
