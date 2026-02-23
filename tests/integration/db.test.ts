/**
 * T2.3T — Prisma client singleton integration tests
 *
 * These tests run against a real database (DATABASE_URL required).
 * Skip in unit-only runs: `pnpm test tests/unit` vs `pnpm test tests/integration`
 *
 * Test strategy: create a JobSeeker record, verify it round-trips correctly,
 * then delete it. Uses a unique clerkUserId per test run to avoid collisions.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { PrismaClient } from "@prisma/client"

// Guard — skip integration tests when no database is configured
const hasDb = !!process.env["DATABASE_URL"]

describe.skipIf(!hasDb)("Prisma client singleton", () => {
  let db: PrismaClient
  const testClerkId = `test_user_${Date.now()}`

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance
  })

  afterAll(async () => {
    // Clean up test data
    await db.jobSeeker.deleteMany({
      where: { clerkUserId: { startsWith: "test_user_" } },
    })
    await db.$disconnect()
  })

  it("singleton returns the same PrismaClient instance on repeated imports", async () => {
    const { db: a } = await import("@/lib/db")
    const { db: b } = await import("@/lib/db")
    expect(a).toBe(b)
  })

  it("can create a JobSeeker with minimal required fields", async () => {
    const seeker = await db.jobSeeker.create({
      data: {
        clerkUserId: testClerkId,
        name: "Test Seeker",
        skills: ["TypeScript"],
        urls: [],
      },
    })
    expect(seeker.id).toBeDefined()
    expect(seeker.clerkUserId).toBe(testClerkId)
    expect(seeker.profileCompleteness).toBe(0)
    expect(seeker.isActive).toBe(true)
  })

  it("enforces unique constraint on clerkUserId", async () => {
    await expect(
      db.jobSeeker.create({
        data: {
          clerkUserId: testClerkId, // duplicate
          name: "Duplicate Seeker",
          skills: [],
          urls: [],
        },
      }),
    ).rejects.toThrow()
  })

  it("can query a JobSeeker by clerkUserId", async () => {
    const seeker = await db.jobSeeker.findUnique({
      where: { clerkUserId: testClerkId },
    })
    expect(seeker).not.toBeNull()
    expect(seeker?.name).toBe("Test Seeker")
  })
})

describe("Prisma client module structure", () => {
  it("exports a db named export", async () => {
    const dbModule = await import("@/lib/db")
    expect(dbModule.db).toBeDefined()
    expect(typeof dbModule.db).toBe("object")
  })
})
