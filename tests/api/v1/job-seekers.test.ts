/**
 * REST integration tests for the jobSeekers router (seeker profile endpoints).
 *
 * Tests verify:
 * 1. GET /profile is reachable and auth-gated (401, not 404)
 * 2. PATCH /profile is reachable and auth-gated (401, not 404)
 *
 * Full profile update and completeness tests are covered in
 * the tRPC unit tests for the jobSeekers router.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.setConfig({ testTimeout: 30_000 })

vi.mock("server-only", () => ({}))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("@/lib/flags", () => ({
  PUBLIC_API: () => true,
  assertFlagEnabled: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ invoices: { list: vi.fn() } }) }))
vi.mock("@/lib/stripe-sessions", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    jobSeeker: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    employer: { findUnique: vi.fn() },
    employerMember: { findUnique: vi.fn() },
    jobPosting: { findUnique: vi.fn() },
    match: { findMany: vi.fn(), count: vi.fn() },
    agentConversation: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

import { callV1, callV1Authed } from "tests/helpers/rest-client"

// Warm up the handler (cold-start on WSL2 takes 8–15s)
beforeAll(async () => {
  mockDb.jobSeeker.findUnique.mockResolvedValue(null)
  await callV1("GET", "/health")
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
})

// ---------------------------------------------------------------------------
// GET /profile
// ---------------------------------------------------------------------------

describe("GET /api/v1/profile", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("GET", "/profile")
    expect(res.status).toBe(401)
  })

  it("returns 401 for a caller with no seeker role", async () => {
    // seekerProcedure requires userRole === JOB_SEEKER
    const res = await callV1Authed("GET", "/profile", "bearer-token-no-role")
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// PATCH /profile
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/profile", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("PATCH", "/profile")
    expect(res.status).toBe(401)
  })

  it("returns 401 for a caller with no seeker role", async () => {
    const res = await callV1Authed("PATCH", "/profile", "bearer-token-no-role", {})
    expect(res.status).toBe(401)
  })
})
