/**
 * REST integration tests for the employers router (employer profile endpoints).
 *
 * Tests verify:
 * 1. GET /employer/profile is reachable and auth-gated (401/403, not 404)
 * 2. PATCH /employer/profile is reachable and auth-gated (401/403, not 404)
 *
 * Full profile update tests are covered in the tRPC unit tests for the employers router.
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
    employer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    employerMember: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
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
  mockDb.employer.findUnique.mockResolvedValue(null)
  await callV1("GET", "/health")
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
})

// ---------------------------------------------------------------------------
// GET /employer/profile
// ---------------------------------------------------------------------------

describe("GET /api/v1/employer/profile", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("GET", "/employer/profile")
    // employerProcedure throws FORBIDDEN (403) when userId/orgId/userRole missing
    expect([401, 403]).toContain(res.status)
  })

  it("returns 4xx for a caller with no employer role", async () => {
    // employerProcedure requires userRole === EMPLOYER + orgId
    const res = await callV1Authed("GET", "/employer/profile", "bearer-token-no-role")
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})

// ---------------------------------------------------------------------------
// PATCH /employer/profile
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/employer/profile", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("PATCH", "/employer/profile")
    expect([401, 403]).toContain(res.status)
  })

  it("returns 4xx for a caller with no employer/admin role", async () => {
    // adminProcedure requires org:admin role on top of employerProcedure
    const res = await callV1Authed("PATCH", "/employer/profile", "bearer-token-no-role", {})
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})
