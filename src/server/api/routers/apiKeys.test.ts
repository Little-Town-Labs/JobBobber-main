/**
 * apiKeys tRPC router unit tests (TDD: written first).
 *
 * Tests create, list, and revoke procedures.
 * All Prisma calls and api-keys utilities are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// First test cold-starts dynamic imports (~8–15s on WSL under full-suite load)
vi.setConfig({ testTimeout: 30_000 })

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  apiKey: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const mockGenerateApiKey = vi.hoisted(() => vi.fn())
const mockHashApiKey = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api-keys", () => ({
  generateApiKey: mockGenerateApiKey,
  hashApiKey: mockHashApiKey,
  lookupApiKey: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helper: create tRPC caller
// ---------------------------------------------------------------------------

async function makeCaller(role: "JOB_SEEKER" | "EMPLOYER" = "JOB_SEEKER") {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { apiKeysRouter } = await import("./apiKeys")

  return createCallerFactory(createTRPCRouter({ apiKeys: apiKeysRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: "user_01",
    orgId: role === "EMPLOYER" ? "org_01" : null,
    orgRole: role === "EMPLOYER" ? "org:admin" : null,
    userRole: role,
  } as never)
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeApiKeyRecord(
  overrides: Partial<{
    id: string
    label: string
    keyHash: string
    keyPrefix: string
    ownerId: string
    ownerType: "SEEKER" | "EMPLOYER"
    createdAt: Date
    lastUsedAt: Date | null
    revokedAt: Date | null
  }> = {},
) {
  return {
    id: overrides.id ?? "key_01",
    label: overrides.label ?? "My Key",
    keyHash: overrides.keyHash ?? "hashed_value",
    keyPrefix: overrides.keyPrefix ?? "jb_live_",
    ownerId: overrides.ownerId ?? "user_01",
    ownerType: overrides.ownerType ?? "SEEKER",
    createdAt: overrides.createdAt ?? new Date("2026-01-15T00:00:00Z"),
    lastUsedAt: overrides.lastUsedAt ?? null,
    revokedAt: overrides.revokedAt ?? null,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("apiKeys router", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateApiKey.mockReturnValue({ raw: "jb_live_abc123", prefix: "jb_live_" })
    mockHashApiKey.mockReturnValue("sha256_hash_of_key")
    mockDb.apiKey.count.mockResolvedValue(0)
    mockDb.apiKey.create.mockResolvedValue(makeApiKeyRecord({ keyHash: "sha256_hash_of_key" }))
  })

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("returns { id, raw, label, prefix, createdAt } with raw key present", async () => {
      const caller = await makeCaller()
      const result = await caller.apiKeys.create({ label: "My Key" })

      expect(result).toMatchObject({
        id: "key_01",
        raw: "jb_live_abc123",
        label: "My Key",
        prefix: "jb_live_",
      })
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it("returns a different raw key on each call", async () => {
      mockGenerateApiKey
        .mockReturnValueOnce({ raw: "jb_live_first", prefix: "jb_live_" })
        .mockReturnValueOnce({ raw: "jb_live_second", prefix: "jb_live_" })

      mockDb.apiKey.create
        .mockResolvedValueOnce(makeApiKeyRecord({ id: "key_01" }))
        .mockResolvedValueOnce(makeApiKeyRecord({ id: "key_02" }))

      const caller = await makeCaller()
      const result1 = await caller.apiKeys.create({ label: "Key 1" })
      const result2 = await caller.apiKeys.create({ label: "Key 2" })

      expect(result1.raw).toBe("jb_live_first")
      expect(result2.raw).toBe("jb_live_second")
      expect(result1.raw).not.toBe(result2.raw)
    })

    it("persists keyHash and keyPrefix to DB, not the raw key", async () => {
      const caller = await makeCaller()
      await caller.apiKeys.create({ label: "Secure Key" })

      expect(mockDb.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keyHash: "sha256_hash_of_key",
            keyPrefix: "jb_live_",
          }),
        }),
      )

      // raw key must NOT be in the create call's data
      const createCall = mockDb.apiKey.create.mock.calls[0]![0] as { data: Record<string, unknown> }
      expect(createCall.data).not.toHaveProperty("raw")
    })

    it("throws BAD_REQUEST when caller already has 10 active keys", async () => {
      mockDb.apiKey.count.mockResolvedValue(10)

      const caller = await makeCaller()
      await expect(caller.apiKeys.create({ label: "One Too Many" })).rejects.toThrow(
        "Maximum 10 active keys allowed",
      )
    })

    it("maps JOB_SEEKER userRole to SEEKER ownerType in DB", async () => {
      const caller = await makeCaller("JOB_SEEKER")
      await caller.apiKeys.create({ label: "Seeker Key" })

      const createCall = mockDb.apiKey.create.mock.calls[0]![0] as { data: Record<string, unknown> }
      expect(createCall.data.ownerType).toBe("SEEKER")
    })

    it("maps EMPLOYER userRole to EMPLOYER ownerType in DB", async () => {
      mockDb.apiKey.create.mockResolvedValue(makeApiKeyRecord({ ownerType: "EMPLOYER" }))
      const caller = await makeCaller("EMPLOYER")
      await caller.apiKeys.create({ label: "Employer Key" })

      const createCall = mockDb.apiKey.create.mock.calls[0]![0] as { data: Record<string, unknown> }
      expect(createCall.data.ownerType).toBe("EMPLOYER")
    })
  })

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe("list", () => {
    it("returns only non-revoked keys for the authenticated caller", async () => {
      mockDb.apiKey.findMany.mockResolvedValue([
        {
          id: "key_01",
          label: "Active Key",
          keyPrefix: "jb_live_",
          createdAt: new Date("2026-01-15"),
          lastUsedAt: null,
        },
        {
          id: "key_02",
          label: "Another Key",
          keyPrefix: "jb_live_",
          createdAt: new Date("2026-01-14"),
          lastUsedAt: new Date("2026-01-16"),
        },
      ])

      const caller = await makeCaller()
      const result = await caller.apiKeys.list()

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ id: "key_01", label: "Active Key", prefix: "jb_live_" })
      expect(result[1]).toMatchObject({ id: "key_02", label: "Another Key", prefix: "jb_live_" })
    })

    it("queries with revokedAt: null to exclude revoked keys", async () => {
      mockDb.apiKey.findMany.mockResolvedValue([])

      const caller = await makeCaller()
      await caller.apiKeys.list()

      const findCall = mockDb.apiKey.findMany.mock.calls[0]![0] as {
        where: { ownerId: string; revokedAt: null }
      }
      expect(findCall.where.revokedAt).toBeNull()
      expect(findCall.where.ownerId).toBe("user_01")
    })

    it("does not include keyHash in response", async () => {
      mockDb.apiKey.findMany.mockResolvedValue([
        {
          id: "key_01",
          label: "Key",
          keyPrefix: "jb_live_",
          createdAt: new Date(),
          lastUsedAt: null,
        },
      ])

      const caller = await makeCaller()
      const result = await caller.apiKeys.list()

      expect(result[0]).not.toHaveProperty("keyHash")
    })

    it("returns empty array when caller has no active keys", async () => {
      mockDb.apiKey.findMany.mockResolvedValue([])

      const caller = await makeCaller()
      const result = await caller.apiKeys.list()

      expect(result).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // revoke
  // -------------------------------------------------------------------------

  describe("revoke", () => {
    it("sets revokedAt on the key record", async () => {
      mockDb.apiKey.findUnique.mockResolvedValue(makeApiKeyRecord({ id: "key_01" }))
      mockDb.apiKey.update.mockResolvedValue(
        makeApiKeyRecord({ id: "key_01", revokedAt: new Date() }),
      )

      const caller = await makeCaller()
      const result = await caller.apiKeys.revoke({ keyId: "key_01" })

      expect(result).toEqual({ success: true })
      expect(mockDb.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "key_01" },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      )
    })

    it("revoked key is excluded from future list calls", async () => {
      mockDb.apiKey.findUnique.mockResolvedValue(makeApiKeyRecord({ id: "key_01" }))
      mockDb.apiKey.update.mockResolvedValue(
        makeApiKeyRecord({ id: "key_01", revokedAt: new Date() }),
      )
      // After revoke, list returns only active keys (DB filtered)
      mockDb.apiKey.findMany.mockResolvedValue([])

      const caller = await makeCaller()
      await caller.apiKeys.revoke({ keyId: "key_01" })
      const list = await caller.apiKeys.list()

      expect(list).toHaveLength(0)
      // Verify list query still filters by revokedAt: null
      const findCall = mockDb.apiKey.findMany.mock.calls[0]![0] as {
        where: { revokedAt: null }
      }
      expect(findCall.where.revokedAt).toBeNull()
    })

    it("throws NOT_FOUND when key does not exist", async () => {
      mockDb.apiKey.findUnique.mockResolvedValue(null)

      const caller = await makeCaller()
      await expect(caller.apiKeys.revoke({ keyId: "missing_key" })).rejects.toThrow(
        "API key not found",
      )
    })

    it("throws NOT_FOUND when key belongs to a different owner", async () => {
      mockDb.apiKey.findUnique.mockResolvedValue(
        makeApiKeyRecord({ id: "key_01", ownerId: "other_user" }),
      )

      const caller = await makeCaller()
      await expect(caller.apiKeys.revoke({ keyId: "key_01" })).rejects.toThrow("API key not found")
    })
  })
})
