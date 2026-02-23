/**
 * T3.1T — tRPC context and middleware tests
 *
 * Tests confirm the context creation and middleware chain behave correctly
 * for all five procedure levels: public, protected, seeker, employer, admin.
 *
 * Mocks Clerk's auth() so no real Clerk instance is needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { TRPCError } from "@trpc/server"

// ---------------------------------------------------------------------------
// Mock @clerk/nextjs/server BEFORE importing the module under test
// ---------------------------------------------------------------------------
const mockAuth = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}))

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    jobSeeker: {
      findUnique: vi.fn(),
    },
    employer: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock the inngest module (added in T4.3)
vi.mock("@/lib/inngest", () => ({
  inngest: {},
}))

describe("createTRPCContext", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns userId=null and orgId=null for an unauthenticated request", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null })

    const { createTRPCContext } = await import("@/server/api/trpc")
    const ctx = await createTRPCContext({
      req: new Request("http://localhost/api/trpc"),
    })

    expect(ctx.userId).toBeNull()
    expect(ctx.orgId).toBeNull()
    expect(ctx.orgRole).toBeNull()
  })

  it("returns userId and orgId for an authenticated request with an org", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_abc123",
      orgId: "org_xyz789",
      orgRole: "org:admin",
      sessionClaims: { metadata: { role: "EMPLOYER" } },
    })

    const { createTRPCContext } = await import("@/server/api/trpc")
    const ctx = await createTRPCContext({
      req: new Request("http://localhost/api/trpc"),
    })

    expect(ctx.userId).toBe("user_abc123")
    expect(ctx.orgId).toBe("org_xyz789")
    expect(ctx.orgRole).toBe("org:admin")
  })
})

describe("protectedProcedure middleware", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("rejects unauthenticated callers with UNAUTHORIZED", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null, orgRole: null })
    const { testHelpers } = await import("@/server/api/trpc")

    await expect(
      testHelpers.callProtected({ userId: null, orgId: null, orgRole: null, userRole: null }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})

describe("seekerProcedure middleware", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("rejects callers with no JobSeeker record with NOT_FOUND", async () => {
    const { db } = await import("@/lib/db")
    vi.mocked(db.jobSeeker.findUnique).mockResolvedValue(null)

    const { testHelpers } = await import("@/server/api/trpc")

    await expect(
      testHelpers.callSeeker({
        userId: "user_abc",
        orgId: null,
        orgRole: null,
        userRole: "JOB_SEEKER",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("employerProcedure middleware", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("rejects callers with no orgId with FORBIDDEN", async () => {
    const { testHelpers } = await import("@/server/api/trpc")

    await expect(
      testHelpers.callEmployer({
        userId: "user_abc",
        orgId: null, // no org context
        orgRole: null,
        userRole: "EMPLOYER",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

describe("adminProcedure middleware", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("rejects org:member callers with FORBIDDEN", async () => {
    const { db } = await import("@/lib/db")
    vi.mocked(db.employer.findUnique).mockResolvedValue({
      id: "emp_01",
      clerkOrgId: "org_xyz",
      name: "Acme",
      industry: null,
      size: null,
      description: null,
      culture: null,
      headquarters: null,
      locations: [],
      websiteUrl: null,
      urls: {},
      benefits: [],
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const { testHelpers } = await import("@/server/api/trpc")

    await expect(
      testHelpers.callAdmin({
        userId: "user_abc",
        orgId: "org_xyz",
        orgRole: "org:member", // not admin
        userRole: "EMPLOYER",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

// Re-export for type checking
export type { TRPCError }
