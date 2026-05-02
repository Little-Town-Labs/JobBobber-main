/**
 * REST integration tests for the insights router.
 *
 * Tests verify:
 * 1. Routes are reachable (401/403 from auth gates, not 404 from unknown-route)
 * 2. Auth enforcement fires correctly for seeker and employer insight endpoints
 *
 * Full flow tests (insight content, threshold logic) are covered in
 * the tRPC unit tests for the insights router.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.setConfig({ testTimeout: 30_000 })

vi.mock("server-only", () => ({}))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("@/lib/flags", () => ({
  PUBLIC_API: () => true,
  FEEDBACK_INSIGHTS: () => true,
  assertFlagEnabled: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ invoices: { list: vi.fn() } }) }))
vi.mock("@/lib/stripe-sessions", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    feedbackInsights: {
      findUnique: vi.fn(),
    },
    agentConversation: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    jobPosting: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    employerMember: { findUnique: vi.fn() },
    match: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

import { callV1, callV1Authed } from "tests/helpers/rest-client"

// Warm up the handler (cold-start on WSL2 takes 8–15s)
beforeAll(async () => {
  mockDb.feedbackInsights.findUnique.mockResolvedValue(null)
  mockDb.agentConversation.count.mockResolvedValue(0)
  await callV1("GET", "/health")
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
})

// ---------------------------------------------------------------------------
// GET /insights/seeker
// ---------------------------------------------------------------------------

describe("GET /api/v1/insights/seeker", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("GET", "/insights/seeker")
    expect(res.status).toBe(401)
  })

  it("returns 401 for a caller with no seeker role", async () => {
    // seekerProcedure requires userRole === JOB_SEEKER
    const res = await callV1Authed("GET", "/insights/seeker", "bearer-token-no-role")
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /insights/employer
// ---------------------------------------------------------------------------

describe("GET /api/v1/insights/employer", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("GET", "/insights/employer")
    expect(res.status).toBe(401)
  })

  it("returns 4xx for a caller with no employer role", async () => {
    // employerProcedure requires userRole === EMPLOYER + orgId
    const res = await callV1Authed("GET", "/insights/employer", "bearer-token-no-role")
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})
