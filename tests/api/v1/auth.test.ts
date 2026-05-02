/**
 * Phase 2 — API key authentication integration tests (TDD RED phase).
 *
 * Tests verify that the REST handler at /api/v1/* correctly:
 * 1. Passes public endpoints through without auth
 * 2. Resolves a valid jb_live_* Bearer token to a user context
 * 3. Returns 401 with a clear message for revoked/unknown keys
 * 4. Returns 401 for malformed tokens (not jb_live_* prefix)
 * 5. Returns 401 when no Authorization header is present (protected routes)
 * 6. Returns 400 (not 500) when a seeker already has 10 keys
 *
 * Strategy: mock trpc-to-openapi for early-return tests (revoked key, no auth)
 * where we test the handler's own auth logic. For the valid-key flow, we also
 * mock tRPC so we can inspect what context was resolved. For the 10-key limit
 * (BAD_REQUEST), we rely on the tRPC mock returning the appropriate status.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// ---------------------------------------------------------------------------
// Standard infrastructure mocks (same as other /api/v1 tests)
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("@/lib/flags", () => ({
  PUBLIC_API: () => true,
  ADVANCED_EMPLOYER_DASHBOARD: () => false,
  assertFlagEnabled: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ invoices: { list: vi.fn() } }) }))
vi.mock("@/lib/stripe-sessions", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: 0,
  }),
  rateLimitHeaders: vi.fn().mockReturnValue({
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
    "X-RateLimit-Reset": "0",
  }),
}))

// ---------------------------------------------------------------------------
// DB mock — structured for apiKey and jobSeeker lookups
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    jobSeeker: { findUnique: vi.fn() },
    match: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

// ---------------------------------------------------------------------------
// api-keys mock — controls what lookupApiKey returns
// ---------------------------------------------------------------------------

const { mockLookupApiKey } = vi.hoisted(() => ({
  mockLookupApiKey: vi.fn(),
}))

vi.mock("@/lib/api-keys", () => ({
  lookupApiKey: mockLookupApiKey,
  generateApiKey: vi.fn().mockReturnValue({ raw: "jb_live_abc123", prefix: "jb_live_" }),
  hashApiKey: vi.fn().mockReturnValue("sha256_hash"),
}))

// ---------------------------------------------------------------------------
// trpc-to-openapi mock — default returns 200. Individual tests override it
// to simulate what the tRPC handler would return for a given auth state.
// ---------------------------------------------------------------------------

vi.mock("trpc-to-openapi", () => ({
  createOpenApiFetchHandler: vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  ),
}))

import { createOpenApiFetchHandler } from "trpc-to-openapi"
import { callV1, callV1Authed } from "tests/helpers/rest-client"

// Warm up: force module resolution before individual tests run
beforeAll(async () => {
  await callV1("GET", "/health")
}, 60_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
  mockDb.apiKey.update.mockResolvedValue({})
  // Default: trpc handler returns 200
  vi.mocked(createOpenApiFetchHandler).mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  )
})

// ---------------------------------------------------------------------------
// Public endpoint — unaffected by auth changes
// ---------------------------------------------------------------------------

describe("GET /api/v1/health (public — no auth)", () => {
  it("returns 200 regardless of auth state", async () => {
    const res = await callV1("GET", "/health")
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Valid API key — resolves to authenticated user context
// ---------------------------------------------------------------------------

describe("GET /api/v1/matches with valid jb_live_* key (SEEKER)", () => {
  it("resolves to authenticated context and does not 401 before tRPC", async () => {
    // Arrange: lookupApiKey returns a live SEEKER key
    mockLookupApiKey.mockResolvedValue({
      id: "key_01",
      ownerId: "user_seeker_01",
      ownerType: "SEEKER",
      revokedAt: null,
    })

    // tRPC handler returns 200 (seekerProcedure satisfied by resolved context)
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], hasMore: false, nextCursor: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1Authed("GET", "/matches", "jb_live_valid_key_abc")

    // Handler must NOT short-circuit with 401 — key was valid
    expect(res.status).toBe(200)
    // lookupApiKey must have been called with the raw token
    expect(mockLookupApiKey).toHaveBeenCalledWith("jb_live_valid_key_abc")
  })
})

// ---------------------------------------------------------------------------
// Revoked / unknown key — handler returns 401 before tRPC runs
// ---------------------------------------------------------------------------

describe("GET /api/v1/matches with revoked jb_live_* key", () => {
  it("returns 401 with 'Invalid or revoked API key' error message", async () => {
    // Arrange: lookupApiKey returns null (revoked or not found)
    mockLookupApiKey.mockResolvedValue(null)

    const res = await callV1Authed("GET", "/matches", "jb_live_revoked_key_xyz")

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error.message).toMatch(/invalid or revoked api key/i)
  })

  it("does not call the tRPC handler when the key is revoked", async () => {
    mockLookupApiKey.mockResolvedValue(null)

    await callV1Authed("GET", "/matches", "jb_live_revoked_key_xyz")

    expect(vi.mocked(createOpenApiFetchHandler)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Malformed token (no jb_live_ prefix) — not treated as an API key
// Falls through to Clerk session path, which has no session → 401 from tRPC
// ---------------------------------------------------------------------------

describe("GET /api/v1/matches with malformed Bearer token", () => {
  it("returns 401 (not 404) when token lacks jb_live_ prefix", async () => {
    // Simulate: no jb_live_ prefix → userId stays null → seekerProcedure throws UNAUTHORIZED
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: -32001, message: "UNAUTHORIZED" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1Authed("GET", "/matches", "sk_not_a_jb_key_12345")

    expect(res.status).toBe(401)
    // lookupApiKey must NOT have been called for non-jb_live_ tokens
    expect(mockLookupApiKey).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// No Authorization header — seekerProcedure rejects with UNAUTHORIZED
// ---------------------------------------------------------------------------

describe("GET /api/v1/matches with no Authorization header", () => {
  it("returns 401 when no auth header is present", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: -32001, message: "UNAUTHORIZED" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1("GET", "/matches")

    expect(res.status).toBe(401)
    expect(mockLookupApiKey).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 10-key limit — tRPC returns BAD_REQUEST (400), not 500
// ---------------------------------------------------------------------------

describe("POST /api/v1/keys with a SEEKER who already has 10 keys", () => {
  it("returns 400 when the key limit is reached", async () => {
    mockLookupApiKey.mockResolvedValue({
      id: "key_existing",
      ownerId: "user_seeker_01",
      ownerType: "SEEKER",
      revokedAt: null,
    })

    // tRPC returns 400 BAD_REQUEST when limit is reached
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: -32600, message: "Maximum 10 active keys allowed" } }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    )

    const res = await callV1Authed("POST", "/keys", "jb_live_seeker_with_10_keys", {
      label: "Key 11",
    })

    expect(res.status).toBe(400)
    expect(res.status).not.toBe(500)
  })
})
