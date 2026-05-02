/**
 * api-keys.test.ts — TDD RED → GREEN for src/lib/api-keys.ts
 *
 * Tests cover:
 *  - generateApiKey: format, entropy, uniqueness
 *  - hashApiKey: SHA-256 determinism and collision resistance
 *  - lookupApiKey: DB miss, revoked key, valid key, fire-and-forget update
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mock @/lib/db before importing the module under test
// ---------------------------------------------------------------------------
const { mockFindUnique, mockUpdate } = vi.hoisted(() => {
  const mockFindUnique = vi.fn()
  const mockUpdate = vi.fn()
  return { mockFindUnique, mockUpdate }
})

vi.mock("@/lib/db", () => ({
  db: {
    apiKey: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}))

// server-only guard trips in unit test environment — silence it
vi.mock("server-only", () => ({}))

import { generateApiKey, hashApiKey, lookupApiKey } from "@/lib/api-keys"

// ---------------------------------------------------------------------------
// generateApiKey
// ---------------------------------------------------------------------------
describe("generateApiKey", () => {
  it("returns an object with { raw, prefix }", () => {
    const result = generateApiKey()
    expect(result).toHaveProperty("raw")
    expect(result).toHaveProperty("prefix")
  })

  it('raw starts with "jb_live_"', () => {
    const { raw } = generateApiKey()
    expect(raw.startsWith("jb_live_")).toBe(true)
  })

  it("raw has at least 32 bytes of entropy (raw.length >= 40 after prefix)", () => {
    const { raw } = generateApiKey()
    // "jb_live_" is 8 chars; base64url of 32 bytes = ~43 chars → total >= 51
    // The requirement says raw.length >= 40 after the 8-char prefix
    expect(raw.length).toBeGreaterThanOrEqual(8 + 40)
  })

  it('prefix is the first 8 chars of raw (always "jb_live_")', () => {
    const { raw, prefix } = generateApiKey()
    expect(prefix).toBe(raw.slice(0, 8))
    expect(prefix).toBe("jb_live_")
  })

  it("two calls return different raw values", () => {
    const first = generateApiKey()
    const second = generateApiKey()
    expect(first.raw).not.toBe(second.raw)
  })
})

// ---------------------------------------------------------------------------
// hashApiKey
// ---------------------------------------------------------------------------
describe("hashApiKey", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = hashApiKey("jb_live_somesecretkey")
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("returns the same hash for the same input", () => {
    const input = "jb_live_deterministickey"
    expect(hashApiKey(input)).toBe(hashApiKey(input))
  })

  it("returns different hashes for different inputs", () => {
    expect(hashApiKey("jb_live_key_one")).not.toBe(hashApiKey("jb_live_key_two"))
  })
})

// ---------------------------------------------------------------------------
// lookupApiKey
// ---------------------------------------------------------------------------
describe("lookupApiKey", () => {
  const fakeKey = "jb_live_testkey12345678901234567890"

  const validRecord = {
    id: "clxxxxxxxxxxxxx",
    label: "My API Key",
    keyHash: hashApiKey(fakeKey),
    keyPrefix: "jb_live_",
    ownerId: "user_abc",
    ownerType: "SEEKER" as const,
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  }

  beforeEach(() => {
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
  })

  it("returns null when key hash not found in DB", async () => {
    mockFindUnique.mockResolvedValue(null)
    const result = await lookupApiKey(fakeKey)
    expect(result).toBeNull()
  })

  it("returns null when key is revoked (revokedAt is not null)", async () => {
    mockFindUnique.mockResolvedValue({ ...validRecord, revokedAt: new Date() })
    const result = await lookupApiKey(fakeKey)
    expect(result).toBeNull()
  })

  it("returns the ApiKey record when key is valid and not revoked", async () => {
    mockFindUnique.mockResolvedValue(validRecord)
    // update is fire-and-forget; let it resolve whenever
    mockUpdate.mockResolvedValue(validRecord)

    const result = await lookupApiKey(fakeKey)
    expect(result).toEqual(validRecord)
  })

  it("calls db.apiKey.findUnique with the keyHash", async () => {
    mockFindUnique.mockResolvedValue(null)

    await lookupApiKey(fakeKey)

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { keyHash: hashApiKey(fakeKey) },
    })
  })

  it("fires a fire-and-forget lastUsedAt update (does NOT await it)", async () => {
    mockFindUnique.mockResolvedValue(validRecord)

    // Return a promise that never resolves during this test to prove
    // lookupApiKey does not block on the update call.
    let resolveUpdate!: () => void
    const neverDuringTest = new Promise<typeof validRecord>((resolve) => {
      resolveUpdate = () => resolve(validRecord)
    })
    mockUpdate.mockReturnValue(neverDuringTest)

    // lookupApiKey must resolve even though the update promise hasn't settled
    const result = await lookupApiKey(fakeKey)
    expect(result).toEqual(validRecord)

    // The update must have been called (fire) …
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: validRecord.id },
      data: { lastUsedAt: expect.any(Date) },
    })

    // … and we resolve it now to avoid unhandled-rejection noise
    resolveUpdate()
    await neverDuringTest
  })
})
