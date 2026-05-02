/**
 * REST integration tests for the conversations router.
 *
 * Tests verify:
 * 1. Routes are reachable (401 from auth gates, not 404 from unknown-route)
 * 2. Auth enforcement fires correctly for both listForSeeker and getById
 *
 * Full flow tests (message redaction, ownership checks) are covered in
 * the tRPC unit tests for the conversations router.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.setConfig({ testTimeout: 30_000 })

vi.mock("server-only", () => ({}))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("@/lib/flags", () => ({
  PUBLIC_API: () => true,
  CONVERSATION_LOGS: () => true,
  assertFlagEnabled: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ invoices: { list: vi.fn() } }) }))
vi.mock("@/lib/stripe-sessions", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    agentConversation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
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
  mockDb.agentConversation.findMany.mockResolvedValue([])
  await callV1("GET", "/health")
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
})

// ---------------------------------------------------------------------------
// GET /conversations
// ---------------------------------------------------------------------------

describe("GET /api/v1/conversations", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("GET", "/conversations")
    expect(res.status).toBe(401)
  })

  it("returns 401 for a caller with no seeker role", async () => {
    // seekerProcedure requires userRole === JOB_SEEKER — REST context has null role
    const res = await callV1Authed("GET", "/conversations", "bearer-token-no-role")
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /conversations/:id
// ---------------------------------------------------------------------------

describe("GET /api/v1/conversations/:id", () => {
  it("returns 401 without auth token (route exists — not 404)", async () => {
    const res = await callV1("GET", "/conversations/conv_1")
    expect(res.status).toBe(401)
  })

  it("returns 401 for a caller with no recognized role", async () => {
    // protectedProcedure requires userId + userRole; REST context has neither
    const res = await callV1Authed("GET", "/conversations/conv_1", "bearer-token-no-role")
    expect(res.status).toBe(401)
  })
})
