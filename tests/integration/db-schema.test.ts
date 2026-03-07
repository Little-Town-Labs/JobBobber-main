/**
 * T1.1 — Schema migration verification tests
 *
 * Verifies that the Prisma migration for Feature 2 (authentication-byok) has
 * been applied correctly. These tests check for the presence of new BYOK
 * columns on the Employer and SeekerSettings tables via raw SQL introspection.
 *
 * Tests FAIL before migration (columns not in DB),
 * Tests PASS after migration (columns present).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { PrismaClient } from "@prisma/client"

const hasDb = !!process.env["DATABASE_URL"]

// ---------------------------------------------------------------------------
// Employer BYOK fields (new in Feature 2)
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Schema: Employer BYOK fields (Feature 2 migration)", () => {
  let db: PrismaClient

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance
  })

  afterAll(async () => {
    await db.$disconnect()
  })

  it("employers table has byok_api_key_encrypted column", async () => {
    const result = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employers'
        AND column_name = 'byok_api_key_encrypted'
    `
    expect(result.length).toBe(1)
    expect(result[0]!.column_name).toBe("byok_api_key_encrypted")
  })

  it("employers table has byok_provider column", async () => {
    const result = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employers'
        AND column_name = 'byok_provider'
    `
    expect(result.length).toBe(1)
    expect(result[0]!.column_name).toBe("byok_provider")
  })

  it("employers table has byok_key_validated_at column", async () => {
    const result = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employers'
        AND column_name = 'byok_key_validated_at'
    `
    expect(result.length).toBe(1)
    expect(result[0]!.column_name).toBe("byok_key_validated_at")
  })

  it("employers table has byok_masked_key column", async () => {
    const result = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employers'
        AND column_name = 'byok_masked_key'
    `
    expect(result.length).toBe(1)
    expect(result[0]!.column_name).toBe("byok_masked_key")
  })

  it("all 4 Employer BYOK columns are present together", async () => {
    const result = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'employers'
        AND column_name IN (
          'byok_api_key_encrypted',
          'byok_provider',
          'byok_key_validated_at',
          'byok_masked_key'
        )
      ORDER BY column_name
    `
    expect(result.length).toBe(4)
  })

  it("Employer BYOK columns are all nullable (no NOT NULL constraint)", async () => {
    const result = await db.$queryRaw<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'employers'
        AND column_name IN (
          'byok_api_key_encrypted',
          'byok_provider',
          'byok_key_validated_at',
          'byok_masked_key'
        )
    `
    for (const col of result) {
      expect(col.is_nullable).toBe("YES")
    }
  })
})

// ---------------------------------------------------------------------------
// SeekerSettings byokMaskedKey (new in Feature 2)
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Schema: SeekerSettings byokMaskedKey field (Feature 2 migration)", () => {
  let db: PrismaClient

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance
  })

  afterAll(async () => {
    await db.$disconnect()
  })

  it("seeker_settings table has byok_masked_key column", async () => {
    const result = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'seeker_settings'
        AND column_name = 'byok_masked_key'
    `
    expect(result.length).toBe(1)
    expect(result[0]!.column_name).toBe("byok_masked_key")
  })

  it("seeker_settings byok_masked_key is nullable", async () => {
    const result = await db.$queryRaw<{ is_nullable: string }[]>`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'seeker_settings'
        AND column_name = 'byok_masked_key'
    `
    expect(result[0]!.is_nullable).toBe("YES")
  })
})

// ---------------------------------------------------------------------------
// Prisma client type-level checks (verifies Prisma client was regenerated)
// ---------------------------------------------------------------------------

describe.skipIf(!hasDb)("Prisma client: BYOK field round-trips", () => {
  let db: PrismaClient
  const testOrgId = `test_byok_schema_${Date.now()}`
  let employerId: string

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/lib/db")
    db = dbInstance
    const employer = await db.employer.create({
      data: { clerkOrgId: testOrgId, name: "BYOK Schema Test Employer" },
    })
    employerId = employer.id
  })

  afterAll(async () => {
    await db.employer.delete({ where: { id: employerId } }).catch(() => {})
    await db.$disconnect()
  })

  it("can write and read byokApiKeyEncrypted on Employer", async () => {
    const updated = await db.employer.update({
      where: { id: employerId },
      data: { byokApiKeyEncrypted: "test_ciphertext_base64" },
    })
    expect(updated.byokApiKeyEncrypted).toBe("test_ciphertext_base64")
  })

  it("can write and read byokProvider on Employer", async () => {
    const updated = await db.employer.update({
      where: { id: employerId },
      data: { byokProvider: "openai" },
    })
    expect(updated.byokProvider).toBe("openai")
  })

  it("can write and read byokKeyValidatedAt on Employer", async () => {
    const now = new Date()
    const updated = await db.employer.update({
      where: { id: employerId },
      data: { byokKeyValidatedAt: now },
    })
    expect(updated.byokKeyValidatedAt).toBeInstanceOf(Date)
  })

  it("can write and read byokMaskedKey on Employer", async () => {
    const updated = await db.employer.update({
      where: { id: employerId },
      data: { byokMaskedKey: "sk-...xxxx" },
    })
    expect(updated.byokMaskedKey).toBe("sk-...xxxx")
  })

  it("all Employer BYOK fields default to null on creation", async () => {
    const fresh = await db.employer.create({
      data: { clerkOrgId: `test_fresh_byok_${Date.now()}`, name: "Fresh Employer" },
    })
    expect(fresh.byokApiKeyEncrypted).toBeNull()
    expect(fresh.byokProvider).toBeNull()
    expect(fresh.byokKeyValidatedAt).toBeNull()
    expect(fresh.byokMaskedKey).toBeNull()
    await db.employer.delete({ where: { id: fresh.id } })
  })
})
