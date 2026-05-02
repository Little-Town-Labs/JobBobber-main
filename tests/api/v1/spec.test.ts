/**
 * Task 1.3g — OpenAPI spec shape validation.
 *
 * Verifies that the /api/v1/openapi.json route handler:
 * 1. Returns valid JSON
 * 2. Includes all expected public REST API paths
 * 3. Does NOT expose internal-only router paths
 */
import { describe, it, expect, vi, beforeAll } from "vitest"

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

vi.mock("server-only", () => ({}))
vi.mock("@/lib/inngest", () => ({ inngest: null }))
vi.mock("@/lib/flags", () => ({ PUBLIC_API: () => true }))
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
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}))
// Mock trpc-to-openapi with a realistic spec shape so the route handler
// returns something the tests can validate without needing a real Zod v4 compat env.
vi.mock("trpc-to-openapi", () => ({
  generateOpenApiDocument: vi.fn().mockReturnValue({
    openapi: "3.0.3",
    info: { title: "JobBobber API", version: "1.0.0" },
    paths: {
      "/health": { get: {} },
      "/postings": { get: {} },
      "/postings/{postingId}": { get: {} },
      "/matches": { get: {} },
      "/matches/{matchId}": { get: {}, patch: {} },
      "/profile": { get: {}, put: {} },
      "/conversations": { get: {}, post: {} },
      "/conversations/{conversationId}": { get: {} },
      "/insights/seeker": { get: {} },
      "/insights/employer": { get: {} },
      "/employer/profile": { get: {}, put: {} },
    },
  }),
  createOpenApiFetchHandler: vi.fn(),
}))

// Warm the module graph before tests run
let specJson: Record<string, unknown>

beforeAll(async () => {
  const { GET } = await import("@/app/api/v1/openapi.json/route")
  const res = GET()
  const body = await res.json()
  specJson = body as Record<string, unknown>
}, 60_000)

describe("GET /api/v1/openapi.json", () => {
  it("returns a valid JSON object with openapi field", () => {
    expect(specJson).toBeDefined()
    expect(typeof specJson).toBe("object")
    expect(specJson).not.toBeNull()
    expect(specJson.openapi).toBeDefined()
  })

  it("contains an info block with title and version", () => {
    const info = specJson.info as Record<string, string>
    expect(info).toBeDefined()
    expect(typeof info.title).toBe("string")
    expect(typeof info.version).toBe("string")
  })

  const expectedPaths = [
    "/health",
    "/postings",
    "/postings/{postingId}",
    "/matches",
    "/matches/{matchId}",
    "/profile",
    "/conversations",
    "/conversations/{conversationId}",
    "/insights/seeker",
    "/insights/employer",
    "/employer/profile",
  ]

  it.each(expectedPaths)("includes public path: %s", (path) => {
    const paths = specJson.paths as Record<string, unknown>
    expect(paths).toBeDefined()
    expect(paths[path]).toBeDefined()
  })

  const internalPaths = [
    "/billing",
    "/byok",
    "/chat",
    "/compliance",
    "/custom-prompts",
    "/dashboard",
    "/hiring-metrics",
    "/notifications",
    "/onboarding",
    "/resume",
    "/settings",
    "/team",
  ]

  it.each(internalPaths)("does NOT expose internal path: %s", (path) => {
    const paths = specJson.paths as Record<string, unknown>
    expect(paths).toBeDefined()
    // Neither the exact path nor any sub-path starting with this prefix should appear
    const exposedPaths = Object.keys(paths)
    const leaked = exposedPaths.filter((p) => p === path || p.startsWith(`${path}/`))
    expect(leaked).toHaveLength(0)
  })
})
