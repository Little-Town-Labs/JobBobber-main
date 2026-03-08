/**
 * Task 1.3 — Tests for enhanced employerProcedure (ctx.member) and jobPosterProcedure.
 *
 * Verifies:
 * - employerProcedure loads ctx.member from EmployerMember table
 * - employerProcedure allows ADMIN, JOB_POSTER, VIEWER
 * - jobPosterProcedure allows ADMIN and JOB_POSTER, rejects VIEWER
 * - adminProcedure allows only ADMIN (existing behavior)
 * - Backward compat: single-user employer passes all tiers
 * - Missing EmployerMember record throws FORBIDDEN
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockEmployer, createMockEmployerMember } from "tests/helpers/create-entities"

const mockAuth = vi.fn()
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth }))

const mockEmployerFindUnique = vi.fn()
const mockMemberFindUnique = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    jobSeeker: { findUnique: vi.fn() },
    employer: { findUnique: mockEmployerFindUnique },
    employerMember: { findUnique: mockMemberFindUnique },
  },
}))

vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const EMPLOYER = createMockEmployer({ id: "emp_01", clerkOrgId: "org_xyz", name: "Acme" })

function setupMocks(role: "ADMIN" | "JOB_POSTER" | "VIEWER") {
  mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
  mockMemberFindUnique.mockResolvedValue(
    createMockEmployerMember({
      employerId: "emp_01",
      clerkUserId: "user_abc",
      role,
    }),
  )
}

const EMPLOYER_CTX = {
  userId: "user_abc",
  orgId: "org_xyz",
  orgRole: "org:admin" as const,
  userRole: "EMPLOYER" as const,
}

const MEMBER_CTX = {
  ...EMPLOYER_CTX,
  orgRole: "org:member" as const,
}

describe("employerProcedure with ctx.member", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("loads ctx.member for ADMIN role", async () => {
    setupMocks("ADMIN")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callEmployer(EMPLOYER_CTX)
    expect(result).toBe("ok")
  })

  it("loads ctx.member for JOB_POSTER role", async () => {
    setupMocks("JOB_POSTER")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callEmployer(MEMBER_CTX)
    expect(result).toBe("ok")
  })

  it("loads ctx.member for VIEWER role", async () => {
    setupMocks("VIEWER")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callEmployer(MEMBER_CTX)
    expect(result).toBe("ok")
  })

  it("rejects when EmployerMember record not found", async () => {
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
    mockMemberFindUnique.mockResolvedValue(null)

    const { testHelpers } = await import("@/server/api/trpc")
    await expect(testHelpers.callEmployer(EMPLOYER_CTX)).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })
})

describe("jobPosterProcedure", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("allows ADMIN role", async () => {
    setupMocks("ADMIN")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callJobPoster(EMPLOYER_CTX)
    expect(result).toBe("ok")
  })

  it("allows JOB_POSTER role", async () => {
    setupMocks("JOB_POSTER")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callJobPoster(MEMBER_CTX)
    expect(result).toBe("ok")
  })

  it("rejects VIEWER role with FORBIDDEN", async () => {
    setupMocks("VIEWER")
    const { testHelpers } = await import("@/server/api/trpc")
    await expect(testHelpers.callJobPoster(MEMBER_CTX)).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })
})

describe("adminProcedure with ctx.member", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("allows org:admin with ADMIN member role", async () => {
    setupMocks("ADMIN")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callAdmin(EMPLOYER_CTX)
    expect(result).toBe("ok")
  })

  it("rejects org:member even with ADMIN member role", async () => {
    setupMocks("ADMIN")
    const { testHelpers } = await import("@/server/api/trpc")
    await expect(testHelpers.callAdmin(MEMBER_CTX)).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })
})

describe("backward compatibility - single-user employer", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("existing admin passes employerProcedure with ctx.member loaded", async () => {
    setupMocks("ADMIN")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callEmployer(EMPLOYER_CTX)
    expect(result).toBe("ok")
  })

  it("existing admin passes jobPosterProcedure", async () => {
    setupMocks("ADMIN")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callJobPoster(EMPLOYER_CTX)
    expect(result).toBe("ok")
  })

  it("existing admin passes adminProcedure", async () => {
    setupMocks("ADMIN")
    const { testHelpers } = await import("@/server/api/trpc")
    const result = await testHelpers.callAdmin(EMPLOYER_CTX)
    expect(result).toBe("ok")
  })
})
