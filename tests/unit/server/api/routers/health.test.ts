/**
 * T3.2T — Health router tests
 *
 * Tests the health router procedures directly using createCaller,
 * with all transitive dependencies mocked to avoid import hangs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock all transitive deps BEFORE importing the router
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null, orgId: null, orgRole: null }),
}))

vi.mock("@/lib/inngest", () => ({ inngest: {} }))

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    jobSeeker: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
  },
}))

// Mock the entire root router to avoid importing every router in the app.
vi.mock("@/server/api/root", async () => {
  const trpc = (await vi.importActual("@/server/api/trpc")) as {
    createTRPCRouter: (...args: unknown[]) => unknown
  }
  const health = (await vi.importActual("@/server/api/routers/health")) as { healthRouter: unknown }
  return {
    appRouter: trpc.createTRPCRouter({ health: health.healthRouter }),
  }
})

import { appRouter } from "@/server/api/root"
import { db } from "@/lib/db"

const mockQueryRaw = vi.mocked(db.$queryRaw)

function createCaller() {
  return appRouter.createCaller({
    db: db as never,
    inngest: null,
    userId: null,
    orgId: null,
    orgRole: null,
    userRole: null,
  })
}

describe("health.ping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns { status: 'ok', timestamp: string } without authentication", async () => {
    const caller = createCaller()
    const result = await caller.health.ping()

    expect(result.status).toBe("ok")
    expect(typeof result.timestamp).toBe("string")
    expect(() => new Date(result.timestamp)).not.toThrow()
  })
})

describe("health.deepCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns healthy=true with all checks ok when DB responds", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }] as never)
    const caller = createCaller()

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
    mockQueryRaw.mockRejectedValue(new Error("connection refused") as never)
    const caller = createCaller()

    const result = await caller.health.deepCheck()

    expect(result.healthy).toBe(false)
    const dbCheck = result.checks.find((c) => c.name === "database")
    expect(dbCheck?.status).toBe("unreachable")
  })
})
