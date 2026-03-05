/**
 * Task 3.1 — Logo upload route handler unit tests
 *
 * Test cases:
 *   1. Unauthenticated request → 401
 *   2. Authenticated user with no org → 403
 *   3. Authenticated user with org but no Employer row → 403
 *   4. Valid employer → 200 with client token
 *   5. Allowed MIME types: PNG, JPEG, WebP
 *   6. Max file size: 2 MB
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn()
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}))

const mockEmployerFindUnique = vi.fn()
vi.mock("@/lib/db", () => ({
  db: {
    employer: { findUnique: mockEmployerFindUnique },
  },
}))

const mockHandleUpload = vi.fn()
vi.mock("@vercel/blob/client", () => ({
  handleUpload: mockHandleUpload,
}))

vi.mock("server-only", () => ({}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPLOYER = { id: "emp_01", clerkOrgId: "org_clerk_01", name: "Acme Corp" }

function makeRequest(body: unknown = {}) {
  return new Request("http://localhost/api/employer/logo/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/employer/logo/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockHandleUpload.mockResolvedValue(
      new Response(JSON.stringify({ token: "tok_abc" }), { status: 200 }),
    )
  })

  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null })
    const { POST } = await import("@/app/api/employer/logo/upload/route")
    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
  })

  it("returns 403 when user has no org membership", async () => {
    mockAuth.mockResolvedValue({ userId: "user_01", orgId: null })
    const { POST } = await import("@/app/api/employer/logo/upload/route")
    const response = await POST(makeRequest())
    expect(response.status).toBe(403)
  })

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_01", orgId: "org_01", orgRole: "org:member" })
    const { POST } = await import("@/app/api/employer/logo/upload/route")
    const response = await POST(makeRequest())
    expect(response.status).toBe(403)
  })

  it("returns 403 when org has no Employer row", async () => {
    mockAuth.mockResolvedValue({ userId: "user_01", orgId: "org_01", orgRole: "org:admin" })
    mockEmployerFindUnique.mockResolvedValue(null)
    const { POST } = await import("@/app/api/employer/logo/upload/route")
    const response = await POST(makeRequest())
    expect(response.status).toBe(403)
  })

  it("returns 200 with client token for valid employer", async () => {
    mockAuth.mockResolvedValue({ userId: "user_01", orgId: "org_clerk_01", orgRole: "org:admin" })
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)
    const { POST } = await import("@/app/api/employer/logo/upload/route")
    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    expect(mockHandleUpload).toHaveBeenCalledOnce()
  })

  it("allows only image/png, image/jpeg, image/webp", async () => {
    mockAuth.mockResolvedValue({ userId: "user_01", orgId: "org_clerk_01", orgRole: "org:admin" })
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)

    let tokenConfig: Record<string, unknown> | null = null
    mockHandleUpload.mockImplementation(async (opts: Record<string, unknown>) => {
      tokenConfig = (await (opts.onBeforeGenerateToken as (p: string) => Promise<unknown>)(
        "logos/acme.png",
      )) as Record<string, unknown>
      return new Response("{}", { status: 200 })
    })

    const { POST } = await import("@/app/api/employer/logo/upload/route")
    await POST(makeRequest())

    expect(tokenConfig).not.toBeNull()
    const types = (tokenConfig as Record<string, unknown>).allowedContentTypes as string[]
    expect(types).toContain("image/png")
    expect(types).toContain("image/jpeg")
    expect(types).toContain("image/webp")
    expect(types).toHaveLength(3)
  })

  it("sets max file size to 2 MB", async () => {
    mockAuth.mockResolvedValue({ userId: "user_01", orgId: "org_clerk_01", orgRole: "org:admin" })
    mockEmployerFindUnique.mockResolvedValue(EMPLOYER)

    let tokenConfig: Record<string, unknown> | null = null
    mockHandleUpload.mockImplementation(async (opts: Record<string, unknown>) => {
      tokenConfig = (await (opts.onBeforeGenerateToken as (p: string) => Promise<unknown>)(
        "logos/acme.png",
      )) as Record<string, unknown>
      return new Response("{}", { status: 200 })
    })

    const { POST } = await import("@/app/api/employer/logo/upload/route")
    await POST(makeRequest())

    expect((tokenConfig as Record<string, unknown>).maximumSizeInBytes).toBe(2 * 1024 * 1024)
  })
})
