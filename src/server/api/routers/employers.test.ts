/**
 * Task 2.1 — employers router unit tests
 *
 * Prisma client is mocked — no live DB.
 *
 * Procedures tested:
 *   getMe, getById, updateProfile, updateLogo
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

const mockEmployerFindUnique = vi.fn()
const mockEmployerUpdate = vi.fn()

const mockEmployerMemberFindUnique = vi.fn()

const mockDb = {
  employer: {
    findUnique: mockEmployerFindUnique,
    update: mockEmployerUpdate,
  },
  employerMember: { findUnique: mockEmployerMemberFindUnique },
  jobSeeker: { findUnique: vi.fn() },
  seekerSettings: { findFirst: vi.fn() },
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const EMPLOYER = {
  id: "emp_01",
  clerkOrgId: "org_clerk_01",
  name: "Acme Corp",
  industry: "Technology",
  size: "51-200",
  description: "We build things",
  culture: "Fast-paced",
  headquarters: "San Francisco",
  locations: ["SF", "NY"],
  websiteUrl: "https://acme.com",
  urls: { linkedin: "https://linkedin.com/acme" },
  benefits: ["Health"],
  logoUrl: "https://blob.vercel-storage.com/logos/acme.png",
  byokApiKeyEncrypted: "encrypted_key",
  byokProvider: "openai",
  byokKeyValidatedAt: new Date("2025-06-01"),
  byokMaskedKey: "sk-...xxxx",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-06-01"),
}

// ---------------------------------------------------------------------------
// Helper: create employers caller
// ---------------------------------------------------------------------------

async function makeEmployersCaller(ctx: {
  userId?: string | null
  orgId?: string | null
  orgRole?: "org:admin" | "org:member" | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { employersRouter } = await import("@/server/api/routers/employers")

  return createCallerFactory(createTRPCRouter({ employers: employersRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx.userId ?? "user_clerk_01",
    orgId: ctx.orgId ?? "org_clerk_01",
    orgRole: ctx.orgRole ?? "org:admin",
    userRole: ctx.userRole ?? "EMPLOYER",
    hasByokKey: false,
    employer: EMPLOYER as never,
  } as never)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
  mockEmployerMemberFindUnique.mockResolvedValue({
    id: "member-1",
    employerId: "emp_01",
    clerkUserId: "user_clerk_01",
    role: "ADMIN",
  })
})

describe("employers.getMe", () => {
  it("returns FullEmployerProfile for authenticated employer", async () => {
    const caller = await makeEmployersCaller({})
    const result = await caller.employers.getMe()

    expect(result).toBeDefined()
    expect(result!.id).toBe("emp_01")
    expect(result!.name).toBe("Acme Corp")
    expect(result!.createdAt).toBe("2025-01-01T00:00:00.000Z")
  })

  it("never includes BYOK fields in response", async () => {
    const caller = await makeEmployersCaller({})
    const result = await caller.employers.getMe()

    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("byokProvider")
    expect(result).not.toHaveProperty("byokKeyValidatedAt")
    expect(result).not.toHaveProperty("byokMaskedKey")
    expect(result).not.toHaveProperty("clerkOrgId")
  })

  it("rejects non-employer role", async () => {
    const caller = await makeEmployersCaller({ userRole: "JOB_SEEKER" })
    await expect(caller.employers.getMe()).rejects.toThrow()
  })
})

describe("employers.getById", () => {
  it("returns PublicEmployerProfile (no createdAt, no BYOK)", async () => {
    const caller = await makeEmployersCaller({})
    const result = await caller.employers.getById({ id: "emp_01" })

    expect(result).toBeDefined()
    expect(result).not.toHaveProperty("createdAt")
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).toHaveProperty("updatedAt")
  })

  it("returns null for non-existent ID", async () => {
    mockEmployerFindUnique.mockResolvedValueOnce(null)
    const caller = await makeEmployersCaller({})
    const result = await caller.employers.getById({ id: "non_existent" })
    expect(result).toBeNull()
  })
})

describe("employers.updateProfile", () => {
  it("partial update works (single field)", async () => {
    mockEmployerUpdate.mockResolvedValue({ ...EMPLOYER, name: "New Name" })
    const caller = await makeEmployersCaller({})
    const result = await caller.employers.updateProfile({ name: "New Name" })

    expect(mockEmployerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "New Name" }),
      }),
    )
    expect(result).toBeDefined()
  })

  it("validates websiteUrl format", async () => {
    const caller = await makeEmployersCaller({})
    await expect(caller.employers.updateProfile({ websiteUrl: "not-a-url" })).rejects.toThrow()
  })

  it("rejects non-admin role", async () => {
    const caller = await makeEmployersCaller({ orgRole: "org:member" })
    await expect(caller.employers.updateProfile({ name: "Nope" })).rejects.toThrow()
  })

  it("validates field constraints", async () => {
    const caller = await makeEmployersCaller({})
    // name min 1
    await expect(caller.employers.updateProfile({ name: "" })).rejects.toThrow()
    // description max 5000
    await expect(
      caller.employers.updateProfile({ description: "x".repeat(5001) }),
    ).rejects.toThrow()
  })
})

describe("employers.updateLogo", () => {
  it("persists logoUrl on employer record", async () => {
    mockEmployerUpdate.mockResolvedValue({
      ...EMPLOYER,
      logoUrl: "https://blob.vercel-storage.com/logos/new.png",
    })
    const caller = await makeEmployersCaller({})
    const result = await caller.employers.updateLogo({
      logoUrl: "https://blob.vercel-storage.com/logos/new.png",
    })

    expect(mockEmployerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { logoUrl: "https://blob.vercel-storage.com/logos/new.png" },
      }),
    )
    expect(result).toBeDefined()
  })

  it("rejects non-admin role", async () => {
    const caller = await makeEmployersCaller({ orgRole: "org:member" })
    await expect(
      caller.employers.updateLogo({ logoUrl: "https://example.com/logo.png" }),
    ).rejects.toThrow()
  })
})
