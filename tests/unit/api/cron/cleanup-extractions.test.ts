/**
 * Task 5.2 — ExtractionCache cleanup cron endpoint tests
 *
 * Tests FAIL before src/app/api/cron/cleanup-extractions/route.ts exists.
 *
 * Test cases:
 *   1. Deletes rows where expiresAt < now()
 *   2. Does NOT delete rows where expiresAt >= now()
 *   3. Returns 401 without valid CRON_SECRET authorization header
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockDeleteMany } = vi.hoisted(() => ({
  mockDeleteMany: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    extractionCache: { deleteMany: mockDeleteMany },
  },
}))

// ---------------------------------------------------------------------------
// Import route under test
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/cron/cleanup-extractions/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/cleanup-extractions", {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/cron/cleanup-extractions", () => {
  const CRON_SECRET = "test-cron-secret-value"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", CRON_SECRET)
    mockDeleteMany.mockResolvedValue({ count: 0 })
  })

  it("returns 401 when no authorization header is provided", async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockDeleteMany).not.toHaveBeenCalled()
  })

  it("returns 401 when authorization header has wrong secret", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"))
    expect(res.status).toBe(401)
    expect(mockDeleteMany).not.toHaveBeenCalled()
  })

  it("deletes expired rows (expiresAt < now) and returns count", async () => {
    mockDeleteMany.mockResolvedValue({ count: 3 })
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    })
    const body = await res.json()
    expect(body.deleted).toBe(3)
  })

  it("does not delete rows where expiresAt >= now (uses lt filter, not lte)", async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`))

    const call = mockDeleteMany.mock.calls[0]?.[0] as { where: { expiresAt: { lt: Date } } }
    // Verify it uses `lt` (strictly less than), not `lte`
    expect(call.where.expiresAt).toHaveProperty("lt")
    expect(call.where.expiresAt).not.toHaveProperty("lte")
  })
})
