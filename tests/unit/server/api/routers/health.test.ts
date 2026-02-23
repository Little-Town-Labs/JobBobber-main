/**
 * T3.2T — Health router tests
 *
 * Confirms health.ping and health.deepCheck match the contracts in
 * contracts/trpc-api.ts (HealthPingOutput / HealthDeepCheckOutput).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Clerk auth (not needed for public procedures but trpc.ts imports it)
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null, orgId: null, orgRole: null }),
}))

// Mock the db module
const mockQueryRaw = vi.fn()
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mockQueryRaw,
    jobSeeker: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
  },
}))

// Mock inngest
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

describe("health.ping", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns { status: 'ok', timestamp: string } without authentication", async () => {
    const { appRouter } = await import("@/server/api/root")
    const { db } = await import("@/lib/db")

    const caller = appRouter.createCaller({
      db,
      inngest: null,
      userId: null,
      orgId: null,
      orgRole: null,
      userRole: null,
    })

    const result = await caller.health.ping()

    expect(result.status).toBe("ok")
    expect(typeof result.timestamp).toBe("string")
    // Verify it's a valid ISO 8601 timestamp
    expect(() => new Date(result.timestamp)).not.toThrow()
  })
})

describe("health.deepCheck", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns healthy=true with all checks ok when DB responds", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }])

    const { appRouter } = await import("@/server/api/root")
    const { db } = await import("@/lib/db")

    const caller = appRouter.createCaller({
      db,
      inngest: null,
      userId: null,
      orgId: null,
      orgRole: null,
      userRole: null,
    })

    const result = await caller.health.deepCheck()

    expect(result.healthy).toBe(true)
    expect(result.checks).toBeInstanceOf(Array)
    expect(result.checks.length).toBeGreaterThan(0)

    const dbCheck = result.checks.find((c) => c.name === "database")
    expect(dbCheck).toBeDefined()
    expect(dbCheck?.status).toBe("ok")
    expect(typeof dbCheck?.latencyMs).toBe("number")
    expect(typeof result.timestamp).toBe("string")
  })

  it("returns healthy=false with database status='unreachable' when DB throws", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"))

    const { appRouter } = await import("@/server/api/root")
    const { db } = await import("@/lib/db")

    const caller = appRouter.createCaller({
      db,
      inngest: null,
      userId: null,
      orgId: null,
      orgRole: null,
      userRole: null,
    })

    const result = await caller.health.deepCheck()

    expect(result.healthy).toBe(false)
    const dbCheck = result.checks.find((c) => c.name === "database")
    expect(dbCheck?.status).toBe("unreachable")
  })
})
