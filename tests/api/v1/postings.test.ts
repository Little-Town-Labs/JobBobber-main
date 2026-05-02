/**
 * Task 1.3a — REST integration tests for the jobPostings router (TDD RED phase).
 *
 * Tests:
 * 1. GET /postings  — paginated list of ACTIVE postings (public)
 * 2. GET /postings?locationType=REMOTE  — filter param passes through
 * 3. GET /postings/:id  — single posting (ACTIVE → 200, non-ACTIVE → 404, missing → 404)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.setConfig({ testTimeout: 30_000 })

vi.mock("server-only", () => ({}))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("@/lib/flags", () => ({ PUBLIC_API: () => true }))
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }))
vi.mock("@/lib/plan-limits", () => ({
  checkPostingLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ invoices: { list: vi.fn() } }) }))
vi.mock("@/lib/stripe-sessions", () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    jobPosting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    employer: {
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

const BASE_POSTING = {
  id: "post_1",
  employerId: "emp_1",
  title: "Senior Engineer",
  department: null,
  description: "Build great things",
  responsibilities: null,
  requiredSkills: ["TypeScript"],
  preferredSkills: [],
  experienceLevel: "SENIOR",
  employmentType: "FULL_TIME",
  locationType: "REMOTE",
  locationReq: null,
  salaryMin: null,
  salaryMax: null,
  benefits: [],
  whyApply: null,
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}

import { callV1 } from "tests/helpers/rest-client"

// Warm up the handler (cold-start can take 8–15s on WSL2)
beforeAll(async () => {
  mockDb.jobPosting.findMany.mockResolvedValue([])
  await callV1("GET", "/postings")
}, 30_000)

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }])
})

describe("GET /api/v1/postings", () => {
  it("returns 200 with paginated envelope", async () => {
    mockDb.jobPosting.findMany.mockResolvedValue([BASE_POSTING])

    const res = await callV1("GET", "/postings")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe("post_1")
    expect(body).toHaveProperty("hasMore", false)
    expect(body).toHaveProperty("nextCursor", null)
  })

  it("returns empty list when no active postings", async () => {
    mockDb.jobPosting.findMany.mockResolvedValue([])

    const res = await callV1("GET", "/postings")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
    expect(body.hasMore).toBe(false)
  })

  it("accepts locationType filter without error", async () => {
    mockDb.jobPosting.findMany.mockResolvedValue([BASE_POSTING])

    const res = await callV1("GET", "/postings?locationType=REMOTE")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it("accepts limit and cursor query params", async () => {
    mockDb.jobPosting.findMany.mockResolvedValue([])

    const res = await callV1("GET", "/postings?limit=5")

    expect(res.status).toBe(200)
  })
})

describe("GET /api/v1/postings/:id", () => {
  it("returns 200 for an active posting", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(BASE_POSTING)

    const res = await callV1("GET", "/postings/post_1")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("post_1")
    expect(body.title).toBe("Senior Engineer")
    expect(body.status).toBe("ACTIVE")
    expect(typeof body.updatedAt).toBe("string")
  })

  it("returns 404 for a non-active posting (unauthenticated caller)", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue({ ...BASE_POSTING, status: "DRAFT" })

    const res = await callV1("GET", "/postings/post_1")

    expect(res.status).toBe(404)
  })

  it("returns 404 when posting does not exist", async () => {
    mockDb.jobPosting.findUnique.mockResolvedValue(null)

    const res = await callV1("GET", "/postings/nonexistent-xyz")

    expect(res.status).toBe(404)
  })
})
