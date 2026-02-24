/**
 * T3.3 — onboarding.setRole mutation tests
 *
 * Unit tests for the onboardingRouter. All external dependencies
 * (Clerk SDK, Prisma) are mocked. Tests FAIL before onboarding.ts exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must be defined before imports (Vitest hoists vi.mock calls)
// ---------------------------------------------------------------------------

// Use vi.hoisted so variables are available inside vi.mock factory functions
const { mockClerkClient, mockCreateOrganization, mockDeleteOrganization, mockUpdateMeta } =
  vi.hoisted(() => {
    const mockUpdateMeta = vi.fn()
    const mockCreateOrganization = vi.fn()
    const mockDeleteOrganization = vi.fn()
    const mockClerkClient = {
      users: { updateUserMetadata: mockUpdateMeta },
      organizations: {
        createOrganization: mockCreateOrganization,
        deleteOrganization: mockDeleteOrganization,
      },
    }
    return { mockClerkClient, mockCreateOrganization, mockDeleteOrganization, mockUpdateMeta }
  })

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: vi.fn().mockResolvedValue(mockClerkClient),
}))

const mockDb = vi.hoisted(() => ({
  jobSeeker: { create: vi.fn() },
  employer: { create: vi.fn() },
  seekerSettings: { create: vi.fn() },
  employerMember: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// ---------------------------------------------------------------------------
// Helper: make a tRPC caller with a given context
// ---------------------------------------------------------------------------

async function makeOnboardingCaller(ctx: {
  userId: string | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { onboardingRouter } = await import("@/server/api/routers/onboarding")

  return createCallerFactory(createTRPCRouter({ onboarding: onboardingRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx.userId,
    orgId: null,
    orgRole: null,
    userRole: ctx.userRole ?? null,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("onboarding.setRole — Test Case 7: no session", () => {
  beforeEach(() => vi.clearAllMocks())

  it("throws UNAUTHORIZED when userId is null", async () => {
    const caller = await makeOnboardingCaller({ userId: null })
    await expect(caller.onboarding.setRole({ role: "JOB_SEEKER" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })
})

describe("onboarding.setRole — Test Case 6: invalid role", () => {
  beforeEach(() => vi.clearAllMocks())

  it("throws BAD_REQUEST for an unknown role value", async () => {
    const caller = await makeOnboardingCaller({ userId: "user_abc" })
    await expect(
      // @ts-expect-error — intentionally passing invalid role
      caller.onboarding.setRole({ role: "INVALID_ROLE" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("onboarding.setRole — Test Case 5: missing companyName", () => {
  beforeEach(() => vi.clearAllMocks())

  it("throws BAD_REQUEST when EMPLOYER has no companyName", async () => {
    const caller = await makeOnboardingCaller({ userId: "user_abc" })
    await expect(caller.onboarding.setRole({ role: "EMPLOYER" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("throws BAD_REQUEST when companyName is only whitespace", async () => {
    const caller = await makeOnboardingCaller({ userId: "user_abc" })
    await expect(
      caller.onboarding.setRole({ role: "EMPLOYER", companyName: "   " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("onboarding.setRole — Test Case 3: idempotency", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns success without side effects when userRole is already set", async () => {
    const caller = await makeOnboardingCaller({
      userId: "user_abc",
      userRole: "JOB_SEEKER",
    })
    const result = await caller.onboarding.setRole({ role: "JOB_SEEKER" })

    expect(result).toMatchObject({ success: true, redirectTo: "/setup/api-key" })
    expect(mockDb.$transaction).not.toHaveBeenCalled()
    expect(mockUpdateMeta).not.toHaveBeenCalled()
  })
})

describe("onboarding.setRole — Test Case 1: JOB_SEEKER path", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.$transaction.mockImplementation((fn: (db: typeof mockDb) => Promise<unknown>) =>
      fn(mockDb),
    )
    mockDb.jobSeeker.create.mockResolvedValue({ id: "seeker_01" })
    mockDb.seekerSettings.create.mockResolvedValue({ id: "settings_01" })
    mockUpdateMeta.mockResolvedValue({})
  })

  it("creates JobSeeker and SeekerSettings; updates Clerk publicMetadata", async () => {
    const caller = await makeOnboardingCaller({ userId: "user_seeker_1" })
    const result = await caller.onboarding.setRole({ role: "JOB_SEEKER" })

    expect(result).toMatchObject({ success: true, redirectTo: "/setup/api-key" })
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
    expect(mockDb.jobSeeker.create).toHaveBeenCalledOnce()
    expect(mockDb.seekerSettings.create).toHaveBeenCalledOnce()
    expect(mockUpdateMeta).toHaveBeenCalledWith("user_seeker_1", {
      publicMetadata: { role: "JOB_SEEKER" },
    })
  })
})

describe("onboarding.setRole — Test Case 2: EMPLOYER path", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateOrganization.mockResolvedValue({ id: "org_new_123" })
    mockDb.$transaction.mockImplementation((fn: (db: typeof mockDb) => Promise<unknown>) =>
      fn(mockDb),
    )
    mockDb.employer.create.mockResolvedValue({ id: "emp_01" })
    mockDb.employerMember.create.mockResolvedValue({ id: "member_01" })
    mockUpdateMeta.mockResolvedValue({})
  })

  it("creates Clerk Org, Employer, and EmployerMember (ADMIN)", async () => {
    const caller = await makeOnboardingCaller({ userId: "user_employer_1" })
    const result = await caller.onboarding.setRole({
      role: "EMPLOYER",
      companyName: "Acme Corp",
    })

    expect(result).toMatchObject({ success: true, redirectTo: "/setup/api-key" })
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      name: "Acme Corp",
      createdBy: "user_employer_1",
    })
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
    expect(mockDb.employer.create).toHaveBeenCalledOnce()
    expect(mockDb.employerMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) }),
    )
    expect(mockUpdateMeta).toHaveBeenCalledWith("user_employer_1", {
      publicMetadata: { role: "EMPLOYER" },
    })
  })
})

describe("onboarding.setRole — Test Case 4: orphan cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateOrganization.mockResolvedValue({ id: "org_orphan_123" })
    mockDb.$transaction.mockRejectedValue(new Error("DB write failed"))
    mockDeleteOrganization.mockResolvedValue({})
  })

  it("deletes the Clerk org if the DB transaction fails (orphan cleanup)", async () => {
    const caller = await makeOnboardingCaller({ userId: "user_employer_2" })
    await expect(
      caller.onboarding.setRole({ role: "EMPLOYER", companyName: "FailCorp" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })

    expect(mockDeleteOrganization).toHaveBeenCalledWith("org_orphan_123")
  })
})
