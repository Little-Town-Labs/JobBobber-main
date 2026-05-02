/**
 * T5.2 — Integration tests for onboarding and BYOK routers
 *
 * Tests the tRPC routers through createCaller with a real Prisma client,
 * mocked Clerk SDK, and mocked fetch (provider validation).
 *
 * Skipped when DATABASE_URL is not set (CI without a database).
 *
 * Cleanup: each suite uses afterAll to delete created rows.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import type { PrismaClient } from "@prisma/client"

// Skip integration tests unless INTEGRATION_TEST=true is explicitly set
const hasDb = process.env["INTEGRATION_TEST"] === "true"

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(() =>
    Promise.resolve({
      users: { updateUserMetadata: vi.fn().mockResolvedValue({}) },
      organizations: {
        createOrganization: vi.fn().mockResolvedValue({ id: `int_test_org_${Date.now()}` }),
        deleteOrganization: vi.fn().mockResolvedValue({}),
      },
    }),
  ),
}))

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((_key: string, _userId: string) =>
    Promise.resolve(`encrypted_ciphertext_integration_test`),
  ),
  decrypt: vi.fn(() => Promise.resolve("sk-proj-original-key")),
}))

// Provider fetch always succeeds in integration tests (we test live validation separately)
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve({ ok: true, status: 200 } as Response)),
)

// ---------------------------------------------------------------------------
// Router caller factory (imported after mocks)
// ---------------------------------------------------------------------------

import { createCaller } from "@/server/api/root"

function makeIntegrationContext(
  userId: string,
  opts?: { userRole?: "JOB_SEEKER" | "EMPLOYER"; orgId?: string },
) {
  return {
    userId,
    orgId: opts?.orgId ?? null,
    orgRole: null as "org:admin" | "org:member" | null,
    userRole: opts?.userRole ?? null,
    hasByokKey: false,
    inngest: null as never,
  }
}

// ---------------------------------------------------------------------------
// Suite A: setRole — JOB_SEEKER path
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Integration: onboarding.setRole — JOB_SEEKER", () => {
  let db: PrismaClient
  const testUserId = `int_seeker_${Date.now()}`

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance
  })

  afterAll(async () => {
    // Cleanup created rows (SeekerSettings cascade-deletes via JobSeeker)
    await db.jobSeeker.deleteMany({ where: { clerkUserId: testUserId } }).catch(() => {})
    await db.$disconnect()
  })

  it("creates JobSeeker and SeekerSettings rows in a transaction", async () => {
    const ctx = makeIntegrationContext(testUserId)
    const caller = createCaller({ db, ...ctx })

    const result = await caller.onboarding.setRole({ role: "JOB_SEEKER" })

    expect(result.success).toBe(true)
    expect(result.redirectTo).toBe("/setup/api-key")

    const seeker = await db.jobSeeker.findUnique({ where: { clerkUserId: testUserId } })
    expect(seeker).not.toBeNull()
    expect(seeker!.clerkUserId).toBe(testUserId)

    const settings = await db.seekerSettings.findFirst({
      where: { seekerId: seeker!.id },
    })
    expect(settings).not.toBeNull()
  })

  it("is idempotent — second call returns success without creating duplicates", async () => {
    const ctx = makeIntegrationContext(testUserId, { userRole: "JOB_SEEKER" })
    const caller = createCaller({ db, ...ctx })

    const result = await caller.onboarding.setRole({ role: "JOB_SEEKER" })

    expect(result.success).toBe(true)

    // Only one JobSeeker should exist
    const seekers = await db.jobSeeker.findMany({ where: { clerkUserId: testUserId } })
    expect(seekers.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Suite B: setRole — EMPLOYER path
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Integration: onboarding.setRole — EMPLOYER", () => {
  let db: PrismaClient
  const testUserId = `int_employer_${Date.now()}`
  let createdOrgId: string | null = null

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance
  })

  afterAll(async () => {
    if (createdOrgId) {
      await db.employer.deleteMany({ where: { clerkOrgId: createdOrgId } }).catch(() => {})
    }
    await db.$disconnect()
  })

  it("creates Employer and EmployerMember rows with ADMIN role", async () => {
    const ctx = makeIntegrationContext(testUserId)
    const caller = createCaller({ db, ...ctx })

    const result = await caller.onboarding.setRole({
      role: "EMPLOYER",
      companyName: "Integration Test Corp",
    })

    expect(result.success).toBe(true)
    expect(result.redirectTo).toBe("/setup/api-key")

    // Get the org ID from the mock call to capture what was created
    const employer = await db.employer.findFirst({
      where: { name: "Integration Test Corp" },
      include: { members: true },
    })
    expect(employer).not.toBeNull()
    expect(employer!.name).toBe("Integration Test Corp")
    expect(employer!.members.length).toBe(1)
    expect(employer!.members[0]!.clerkUserId).toBe(testUserId)
    expect(employer!.members[0]!.role).toBe("ADMIN")

    createdOrgId = employer!.clerkOrgId
  })
})

// ---------------------------------------------------------------------------
// Suite C: BYOK round-trip — storeKey → getKeyStatus → deleteKey
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Integration: byok round-trip (JOB_SEEKER)", () => {
  let db: PrismaClient
  const testUserId = `int_byok_seeker_${Date.now()}`
  let seekerId: string

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance

    // Create the seeker + settings directly (T5.2 focuses on byok, not re-testing setRole)
    const seeker = await db.jobSeeker.create({
      data: { clerkUserId: testUserId, name: "", skills: [] },
    })
    seekerId = seeker.id
    await db.seekerSettings.create({ data: { seekerId } })
  })

  afterAll(async () => {
    await db.jobSeeker.delete({ where: { id: seekerId } }).catch(() => {})
    await db.$disconnect()
  })

  it("storeKey stores encrypted key and returns masked key — raw key not in response", async () => {
    const ctx = makeIntegrationContext(testUserId, { userRole: "JOB_SEEKER" })
    const caller = createCaller({ db, ...ctx })

    const result = await caller.byok.storeKey({
      provider: "openai",
      apiKey: "sk-proj-integrationtestkey123",
    })

    expect(result.success).toBe(true)
    expect(result.provider).toBe("openai")
    expect(result.maskedKey).toMatch(/^sk-proj/)
    // Raw key must not appear in result
    expect(JSON.stringify(result)).not.toContain("integrationtestkey123")
  })

  it("getKeyStatus returns hasKey: true after storeKey", async () => {
    const ctx = makeIntegrationContext(testUserId, { userRole: "JOB_SEEKER" })
    const caller = createCaller({ db, ...ctx })

    const status = await caller.byok.getKeyStatus()

    expect(status.hasKey).toBe(true)
    expect(status.provider).toBe("openai")
    expect(status.maskedKey).not.toBeNull()
    // Ciphertext must not be in the response
    expect(JSON.stringify(status)).not.toContain("encrypted_ciphertext")
  })

  it("deleteKey clears the stored key", async () => {
    const ctx = makeIntegrationContext(testUserId, { userRole: "JOB_SEEKER" })
    const caller = createCaller({ db, ...ctx })

    const result = await caller.byok.deleteKey()
    expect(result.success).toBe(true)
  })

  it("getKeyStatus returns hasKey: false after deleteKey", async () => {
    const ctx = makeIntegrationContext(testUserId, { userRole: "JOB_SEEKER" })
    const caller = createCaller({ db, ...ctx })

    const status = await caller.byok.getKeyStatus()

    expect(status.hasKey).toBe(false)
    expect(status.provider).toBeNull()
    expect(status.maskedKey).toBeNull()

    // Verify DB row is actually null
    const settings = await db.seekerSettings.findFirst({ where: { seekerId } })
    expect(settings!.byokApiKeyEncrypted).toBeNull()
    expect(settings!.byokMaskedKey).toBeNull()
  })
})
