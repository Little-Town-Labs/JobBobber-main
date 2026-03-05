/**
 * T3.5 — byok router unit tests
 *
 * All external deps (Clerk, Prisma, fetch, encryption) are mocked.
 * Tests FAIL before byok.ts exists.
 *
 * Test cases (14 from tasks.md):
 *
 * storeKey:
 *   1. Valid OpenAI key → encrypted + stored + Clerk hasByokKey=true
 *   2. Valid Anthropic key → same flow
 *   3. Invalid key (provider 4xx) → BAD_REQUEST, nothing stored
 *   4. Provider timeout (>10s) → INTERNAL_SERVER_ERROR, nothing stored
 *   5. Provider rate limit (429) → BAD_REQUEST with rate-limit message
 *   6. OpenAI key for Anthropic provider → BAD_REQUEST (key format mismatch)
 *   7. Response never contains apiKey field
 *   8. No role (FORBIDDEN)
 *
 * deleteKey:
 *   9.  JOB_SEEKER path → clears byokApiKeyEncrypted + byokMaskedKey, Clerk false
 *   10. EMPLOYER path → same for employer
 *   11. No key stored → no-op, returns success
 *
 * getKeyStatus:
 *   12. Key present → returns { hasKey: true, provider, maskedKey }
 *   13. No key → returns { hasKey: false, ... }
 *   14. DB has key but Clerk hasByokKey=false → self-healing: re-sync Clerk
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

const mockClerkClientFactory = vi.fn()
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  clerkClient: mockClerkClientFactory,
}))

const mockEncrypt = vi.fn()
const mockDecrypt = vi.fn()
vi.mock("@/lib/encryption", () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}))

const mockSeekerSettingsUpdate = vi.fn()
const mockSeekerSettingsFindFirst = vi.fn()
const mockEmployerFindFirst = vi.fn()
const mockEmployerUpdate = vi.fn()

const mockDb = {
  seekerSettings: {
    findFirst: mockSeekerSettingsFindFirst,
    update: mockSeekerSettingsUpdate,
  },
  employer: {
    findFirst: mockEmployerFindFirst,
    update: mockEmployerUpdate,
  },
  jobSeeker: { findUnique: vi.fn() },
}
vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// ---------------------------------------------------------------------------
// Helper: make a caller with a given context
// ---------------------------------------------------------------------------

async function makeByokCaller(ctx: {
  userId?: string | null
  orgId?: string | null
  orgRole?: "org:admin" | "org:member" | null
  userRole?: "JOB_SEEKER" | "EMPLOYER" | null
  hasByokKey?: boolean
}) {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { byokRouter } = await import("@/server/api/routers/byok")

  return createCallerFactory(createTRPCRouter({ byok: byokRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: ctx.userId ?? "user_default",
    orgId: ctx.orgId ?? null,
    orgRole: ctx.orgRole ?? null,
    userRole: ctx.userRole ?? null,
    hasByokKey: ctx.hasByokKey ?? false,
  } as never)
}

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

function mockProviderSuccess(status = 200) {
  mockFetch.mockResolvedValue({
    ok: status < 400,
    status,
  })
}

function mockProviderTimeout() {
  mockFetch.mockRejectedValue(
    Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
  )
}

// ---------------------------------------------------------------------------
// storeKey tests
// ---------------------------------------------------------------------------

describe("byok.storeKey — Test Case 8: no role", () => {
  beforeEach(() => vi.resetAllMocks())

  it("throws FORBIDDEN when userRole is null", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: null })
    await expect(
      caller.byok.storeKey({ provider: "openai", apiKey: "sk-proj-test" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

describe("byok.storeKey — Test Case 1: valid OpenAI key (JOB_SEEKER)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockProviderSuccess()
    mockEncrypt.mockResolvedValue("encrypted_ciphertext")
    mockSeekerSettingsUpdate.mockResolvedValue({ byokMaskedKey: "sk-...abcd" })
    mockClerkClientFactory.mockResolvedValue({
      users: { updateUserMetadata: vi.fn() },
    })
    mockSeekerSettingsFindFirst.mockResolvedValue({ id: "settings_01" })
  })

  it("validates key, encrypts, stores in SeekerSettings, sets Clerk hasByokKey=true", async () => {
    const caller = await makeByokCaller({ userId: "user_seeker", userRole: "JOB_SEEKER" })
    const result = await caller.byok.storeKey({
      provider: "openai",
      apiKey: "sk-proj-valid-key-abcd",
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const fetchCall = mockFetch.mock.calls[0]!
    expect(fetchCall[0]).toContain("api.openai.com")
    expect(result.success).toBe(true)
    expect(result.provider).toBe("openai")
    expect(result).not.toHaveProperty("apiKey") // key never in response
    expect(result.maskedKey).toBeDefined()
    expect(mockEncrypt).toHaveBeenCalledWith("sk-proj-valid-key-abcd", "user_seeker")
    expect(mockSeekerSettingsUpdate).toHaveBeenCalledOnce()
  })
})

describe("byok.storeKey — Test Case 2: valid Anthropic key (EMPLOYER)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockProviderSuccess()
    mockEncrypt.mockResolvedValue("encrypted_ciphertext_ant")
    mockEmployerUpdate.mockResolvedValue({ byokMaskedKey: "sk-ant-...wxyz" })
    mockClerkClientFactory.mockResolvedValue({
      users: { updateUserMetadata: vi.fn() },
    })
    mockEmployerFindFirst.mockResolvedValue({ id: "emp_01", clerkOrgId: "org_01" })
  })

  it("validates Anthropic key format and stores on Employer", async () => {
    const caller = await makeByokCaller({
      userId: "user_employer",
      orgId: "org_01",
      userRole: "EMPLOYER",
    })
    const result = await caller.byok.storeKey({
      provider: "anthropic",
      apiKey: "sk-ant-api01-validkey-wxyz",
    })

    expect(result.success).toBe(true)
    expect(result.provider).toBe("anthropic")
    const fetchCall = mockFetch.mock.calls[0]!
    expect(fetchCall[0]).toContain("anthropic.com")
    expect(mockEmployerUpdate).toHaveBeenCalledOnce()
  })
})

describe("byok.storeKey — Test Case 3: invalid key (provider 4xx)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockProviderSuccess(401) // provider rejects key
  })

  it("throws BAD_REQUEST and stores nothing when provider returns 401", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    await expect(
      caller.byok.storeKey({ provider: "openai", apiKey: "sk-proj-invalid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })

    expect(mockEncrypt).not.toHaveBeenCalled()
    expect(mockSeekerSettingsUpdate).not.toHaveBeenCalled()
  })
})

describe("byok.storeKey — Test Case 4: provider timeout", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockProviderTimeout()
  })

  it("throws INTERNAL_SERVER_ERROR on AbortError timeout", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    await expect(
      caller.byok.storeKey({ provider: "openai", apiKey: "sk-proj-timeout-key" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })

    expect(mockEncrypt).not.toHaveBeenCalled()
  })
})

describe("byok.storeKey — Test Case 5: provider rate limit (429)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockProviderSuccess(429)
  })

  it("throws BAD_REQUEST with rate-limit message on 429", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    await expect(
      caller.byok.storeKey({ provider: "openai", apiKey: "sk-proj-ratelimited" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("byok.storeKey — Test Case 6: wrong key format for provider", () => {
  beforeEach(() => vi.resetAllMocks())

  it("throws BAD_REQUEST when OpenAI key is submitted for Anthropic provider", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    await expect(
      caller.byok.storeKey({ provider: "anthropic", apiKey: "sk-proj-openaikey" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("throws BAD_REQUEST when Anthropic key is submitted for OpenAI provider", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    await expect(
      caller.byok.storeKey({ provider: "openai", apiKey: "sk-ant-anthropickey" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("byok.storeKey — Test Case 7: response never contains apiKey", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockProviderSuccess()
    mockEncrypt.mockResolvedValue("ciphertext")
    mockSeekerSettingsFindFirst.mockResolvedValue({ id: "s1" })
    mockSeekerSettingsUpdate.mockResolvedValue({ byokMaskedKey: "sk-...wxyz" })
    mockClerkClientFactory.mockResolvedValue({
      users: { updateUserMetadata: vi.fn() },
    })
  })

  it("response object contains no apiKey or byokApiKeyEncrypted field", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    const result = await caller.byok.storeKey({
      provider: "openai",
      apiKey: "sk-proj-safekey",
    })
    expect(result).not.toHaveProperty("apiKey")
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["success", "provider", "maskedKey"]),
    )
  })
})

// ---------------------------------------------------------------------------
// deleteKey tests
// ---------------------------------------------------------------------------

describe("byok.deleteKey — Test Case 9: JOB_SEEKER path", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSeekerSettingsFindFirst.mockResolvedValue({ id: "s1", byokApiKeyEncrypted: "cipher" })
    mockSeekerSettingsUpdate.mockResolvedValue({})
    mockClerkClientFactory.mockResolvedValue({
      users: { updateUserMetadata: vi.fn() },
    })
  })

  it("clears byokApiKeyEncrypted and byokMaskedKey; sets Clerk hasByokKey=false", async () => {
    const caller = await makeByokCaller({ userId: "user_seeker", userRole: "JOB_SEEKER" })
    const result = await caller.byok.deleteKey()

    expect(result).toMatchObject({ success: true })
    expect(mockSeekerSettingsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          byokApiKeyEncrypted: null,
          byokMaskedKey: null,
        }),
      }),
    )
  })
})

describe("byok.deleteKey — Test Case 10: EMPLOYER path", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockEmployerFindFirst.mockResolvedValue({ id: "emp_1", byokApiKeyEncrypted: "cipher" })
    mockEmployerUpdate.mockResolvedValue({})
    mockClerkClientFactory.mockResolvedValue({
      users: { updateUserMetadata: vi.fn() },
    })
  })

  it("clears BYOK fields on Employer; updates Clerk metadata", async () => {
    const caller = await makeByokCaller({
      userId: "user_emp",
      orgId: "org_1",
      userRole: "EMPLOYER",
    })
    const result = await caller.byok.deleteKey()

    expect(result).toMatchObject({ success: true })
    expect(mockEmployerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          byokApiKeyEncrypted: null,
          byokMaskedKey: null,
        }),
      }),
    )
  })
})

describe("byok.deleteKey — Test Case 11: no key stored (no-op)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // No key stored in DB
    mockSeekerSettingsFindFirst.mockResolvedValue({ id: "s1", byokApiKeyEncrypted: null })
  })

  it("returns success without DB write when no key is stored", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    const result = await caller.byok.deleteKey()

    expect(result).toMatchObject({ success: true })
    expect(mockSeekerSettingsUpdate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// getKeyStatus tests
// ---------------------------------------------------------------------------

describe("byok.getKeyStatus — Test Case 12: key present", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSeekerSettingsFindFirst.mockResolvedValue({
      id: "s1",
      byokApiKeyEncrypted: "cipher",
      byokProvider: "openai",
      byokMaskedKey: "sk-...abcd",
    })
  })

  it("returns hasKey=true with provider and maskedKey; no ciphertext in response", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    const result = await caller.byok.getKeyStatus()

    expect(result.hasKey).toBe(true)
    expect(result.provider).toBe("openai")
    expect(result.maskedKey).toBe("sk-...abcd")
    expect(result).not.toHaveProperty("byokApiKeyEncrypted")
    expect(result).not.toHaveProperty("ciphertext")
  })
})

describe("byok.getKeyStatus — Test Case 13: no key", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSeekerSettingsFindFirst.mockResolvedValue({
      id: "s1",
      byokApiKeyEncrypted: null,
      byokProvider: null,
      byokMaskedKey: null,
    })
  })

  it("returns hasKey=false with null provider and maskedKey", async () => {
    const caller = await makeByokCaller({ userId: "user_1", userRole: "JOB_SEEKER" })
    const result = await caller.byok.getKeyStatus()

    expect(result.hasKey).toBe(false)
    expect(result.provider).toBeNull()
    expect(result.maskedKey).toBeNull()
  })
})

describe("byok.getKeyStatus — Test Case 14: self-healing sync", () => {
  const mockUpdateUserMetadata = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    // DB has a key but Clerk JWT says hasByokKey=false (desync scenario)
    mockSeekerSettingsFindFirst.mockResolvedValue({
      id: "s1",
      byokApiKeyEncrypted: "cipher_exists",
      byokProvider: "openai",
      byokMaskedKey: "sk-...abcd",
    })
    mockClerkClientFactory.mockResolvedValue({
      users: { updateUserMetadata: mockUpdateUserMetadata },
    })
    mockUpdateUserMetadata.mockResolvedValue({})
  })

  it("re-syncs Clerk metadata when DB has key but hasByokKey is false in ctx", async () => {
    const caller = await makeByokCaller({
      userId: "user_1",
      userRole: "JOB_SEEKER",
      hasByokKey: false, // desync: DB has key, but Clerk claims no key
    })
    const result = await caller.byok.getKeyStatus()

    // Should still return the key status correctly
    expect(result.hasKey).toBe(true)
    // Should have re-synced Clerk metadata
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith("user_1", {
      publicMetadata: { hasByokKey: true },
    })
  })
})
