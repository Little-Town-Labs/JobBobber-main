/**
 * Task 1.3b — REST integration tests for the matches router (TDD RED phase).
 *
 * Tests verify:
 * 1. Routes are reachable (401 from auth gates, not 404 from unknown-route)
 * 2. Auth enforcement fires correctly at each protection layer
 * 3. accept/decline endpoints exist as distinct REST paths
 *
 * NOTE: Full flow tests (PII hiding, status transitions with seeker/employer roles)
 * require Phase 2 API key auth — those are covered in the tRPC unit tests
 * (src/server/api/routers/matches.test.ts).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.setConfig({ testTimeout: 30_000 })

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

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    match: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    jobPosting: { findUnique: vi.fn() },
    employer: { findUnique: vi.fn() },
    jobSeeker: { findUnique: vi.fn() },
    employerMember: { findUnique: vi.fn() },
    agentConversation: { findMany: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

import { callV1, callV1Authed } from "tests/helpers/rest-client"

// Warm up the handler (cold-start on WSL2 takes 8–15s)
beforeAll(async () => {
  mockDb.match.findMany.mockResolvedValue([])
  await callV1("GET", "/health")
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
})

// ---------------------------------------------------------------------------
// GET /matches
// ---------------------------------------------------------------------------

describe("GET /api/v1/matches", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("GET", "/matches")
    // Before annotation: 404 (route unknown). After: 401 (seekerProcedure UNAUTHORIZED)
    expect(res.status).toBe(401)
  })

  it("returns 401 for a caller with no seeker role", async () => {
    // REST context sets userRole: null — seekerProcedure rejects
    const res = await callV1Authed("GET", "/matches", "bearer-token-no-role")
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /matches/:id
// ---------------------------------------------------------------------------

describe("GET /api/v1/matches/:id", () => {
  it("returns 401 without auth token (route exists)", async () => {
    const res = await callV1("GET", "/matches/match_1")
    expect(res.status).toBe(401)
  })

  it("returns 401 for a caller with no seeker role (route exists, auth gate fires)", async () => {
    // trpc-to-openapi routes GET /matches/* to seekerProcedure first (path prefix match);
    // seekerProcedure UNAUTHORIZED fires for unknown roles → 401 proves route is reachable.
    mockDb.match.findUnique.mockResolvedValue({
      id: "match_1",
      seekerId: "seeker_1",
      employerId: "emp_1",
    })
    const res = await callV1Authed("GET", "/matches/match_1", "bearer-token-no-role")
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /matches/:id/accept
// ---------------------------------------------------------------------------

describe("POST /api/v1/matches/:id/accept", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("POST", "/matches/match_1/accept")
    // Before annotation: 404 (route unknown). After: 401 (protectedProcedure UNAUTHORIZED)
    expect(res.status).toBe(401)
  })

  it("returns 4xx (auth-gated) for a caller with no recognized role", async () => {
    mockDb.match.findUnique.mockResolvedValue({
      id: "match_1",
      seekerId: "seeker_1",
      employerId: "emp_1",
      seekerStatus: "PENDING",
      employerStatus: "PENDING",
    })
    const res = await callV1Authed("POST", "/matches/match_1/accept", "bearer-token-no-role")
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})

// ---------------------------------------------------------------------------
// POST /matches/:id/decline
// ---------------------------------------------------------------------------

describe("POST /api/v1/matches/:id/decline", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("POST", "/matches/match_1/decline")
    expect(res.status).toBe(401)
  })

  it("returns 4xx (auth-gated) for a caller with no recognized role", async () => {
    mockDb.match.findUnique.mockResolvedValue({
      id: "match_1",
      seekerId: "seeker_1",
      employerId: "emp_1",
      seekerStatus: "PENDING",
      employerStatus: "PENDING",
    })
    const res = await callV1Authed("POST", "/matches/match_1/decline", "bearer-token-no-role")
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})
