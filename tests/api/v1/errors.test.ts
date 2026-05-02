/**
 * Task 6.2 — Error envelope normalisation tests (TDD RED phase).
 *
 * Every 4xx/5xx from /api/v1/ MUST return:
 *   Content-Type: application/json
 *   Body: { error: { code: string, message: string } }
 *
 * Additionally:
 *   - 429 responses include Retry-After: 60
 *   - The early 401 for an invalid/revoked API key uses the same envelope
 *   - 404 from an unknown route uses the same envelope
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// ---------------------------------------------------------------------------
// Standard infrastructure mocks
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
// DB mock
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    apiKey: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
    match: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

// ---------------------------------------------------------------------------
// api-keys mock
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
// trpc-to-openapi mock — default: 200. Tests override per-case.
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

beforeAll(async () => {
  await callV1("GET", "/health")
}, 60_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
  mockDb.apiKey.update.mockResolvedValue({})
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
// Error envelope shape helper
// ---------------------------------------------------------------------------

function assertErrorEnvelope(body: unknown): void {
  expect(body).toHaveProperty("error")
  const err = (body as { error: unknown }).error
  expect(err).toHaveProperty("code")
  expect(err).toHaveProperty("message")
  expect(typeof (err as { code: unknown }).code).toBe("string")
  expect(typeof (err as { message: unknown }).message).toBe("string")
}

// ---------------------------------------------------------------------------
// Early 401 — revoked/invalid API key (handler short-circuits before tRPC)
// ---------------------------------------------------------------------------

describe("early 401 for revoked / invalid API key", () => {
  it("returns Content-Type: application/json", async () => {
    mockLookupApiKey.mockResolvedValue(null)

    const res = await callV1Authed("GET", "/matches", "jb_live_revoked_key")

    expect(res.headers.get("content-type")).toMatch(/application\/json/)
  })

  it("returns the standard { error: { code, message } } envelope", async () => {
    mockLookupApiKey.mockResolvedValue(null)

    const res = await callV1Authed("GET", "/matches", "jb_live_revoked_key")
    const body = await res.json()

    assertErrorEnvelope(body)
  })

  it("returns HTTP 401", async () => {
    mockLookupApiKey.mockResolvedValue(null)

    const res = await callV1Authed("GET", "/matches", "jb_live_revoked_key")

    expect(res.status).toBe(401)
  })

  it("includes a human-readable message about the key being invalid", async () => {
    mockLookupApiKey.mockResolvedValue(null)

    const res = await callV1Authed("GET", "/matches", "jb_live_revoked_key")
    const body = (await res.json()) as { error: { message: string } }

    expect(body.error.message).toMatch(/invalid or revoked api key/i)
  })
})

// ---------------------------------------------------------------------------
// 401 from tRPC (unauthenticated route access) — envelope normalisation
// ---------------------------------------------------------------------------

describe("401 from tRPC layer — envelope normalisation", () => {
  it("returns Content-Type: application/json", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "UNAUTHORIZED", code: -32001 } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1("GET", "/matches")

    expect(res.headers.get("content-type")).toMatch(/application\/json/)
  })

  it("returns the standard { error: { code, message } } envelope", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "UNAUTHORIZED", code: -32001 } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1("GET", "/matches")
    const body = await res.json()

    assertErrorEnvelope(body)
  })

  it("uses the HTTP status code as the error code string", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "UNAUTHORIZED", code: -32001 } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1("GET", "/matches")
    const body = (await res.json()) as { error: { code: string } }

    expect(body.error.code).toBe("401")
  })
})

// ---------------------------------------------------------------------------
// 404 — unknown route — envelope normalisation
// ---------------------------------------------------------------------------

describe("404 unknown route — envelope normalisation", () => {
  it("returns Content-Type: application/json", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not found" }), { status: 404 }),
    )

    const res = await callV1("GET", "/nonexistent-route-xyz")

    expect(res.headers.get("content-type")).toMatch(/application\/json/)
  })

  it("returns the standard { error: { code, message } } envelope", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not found" }), { status: 404 }),
    )

    const res = await callV1("GET", "/nonexistent-route-xyz")
    const body = await res.json()

    assertErrorEnvelope(body)
  })

  it("uses '404' as the error code string", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not found" }), { status: 404 }),
    )

    const res = await callV1("GET", "/nonexistent-route-xyz")
    const body = (await res.json()) as { error: { code: string } }

    expect(body.error.code).toBe("404")
  })
})

// ---------------------------------------------------------------------------
// 400 Bad Request — envelope normalisation
// ---------------------------------------------------------------------------

describe("400 Bad Request — envelope normalisation", () => {
  it("returns standard envelope with code '400'", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "Maximum 10 active keys allowed", code: -32600 } }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    )

    mockLookupApiKey.mockResolvedValue({
      id: "key_1",
      ownerId: "user_1",
      ownerType: "SEEKER",
      revokedAt: null,
    })

    const res = await callV1Authed("POST", "/keys", "jb_live_some_key", { label: "Key 11" })
    const body = (await res.json()) as { error: { code: string; message: string } }

    expect(res.status).toBe(400)
    expect(res.headers.get("content-type")).toMatch(/application\/json/)
    assertErrorEnvelope(body)
    expect(body.error.code).toBe("400")
  })
})

// ---------------------------------------------------------------------------
// 429 Too Many Requests — Retry-After header
// ---------------------------------------------------------------------------

describe("429 Too Many Requests — Retry-After header", () => {
  it("includes Retry-After: 60 on 429 responses", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Too many requests", code: -32029 } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1("GET", "/matches")

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("60")
  })

  it("returns standard envelope on 429", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Too many requests", code: -32029 } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1("GET", "/matches")
    const body = await res.json()

    assertErrorEnvelope(body)
    expect((body as { error: { code: string } }).error.code).toBe("429")
  })
})

// ---------------------------------------------------------------------------
// 500 Internal Server Error — envelope normalisation
// ---------------------------------------------------------------------------

describe("500 Internal Server Error — envelope normalisation", () => {
  it("returns standard envelope with code '500'", async () => {
    vi.mocked(createOpenApiFetchHandler).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Internal server error", code: -32603 } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callV1("GET", "/health")
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(res.headers.get("content-type")).toMatch(/application\/json/)
    assertErrorEnvelope(body)
    expect((body as { error: { code: string } }).error.code).toBe("500")
  })
})
