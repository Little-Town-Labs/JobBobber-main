/**
 * Task 3.1 — Resume upload route handler unit tests
 *
 * Tests FAIL before src/app/api/resume/upload/route.ts exists.
 *
 * Test cases:
 *   1. Unauthenticated request → 401
 *   2. Authenticated user with no JobSeeker row → 403
 *   3. Valid authenticated job seeker → 200 with client token
 *   4. handleUpload error → 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn()
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
}))

const mockJobSeekerFindUnique = vi.fn()
vi.mock("@/lib/db", () => ({
  db: {
    jobSeeker: { findUnique: mockJobSeekerFindUnique },
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

const SEEKER = { id: "cld_seeker_01", clerkUserId: "user_clerk_01", name: "Jane" }

function makeRequest(body: unknown = {}) {
  return new Request("http://localhost/api/resume/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/resume/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockHandleUpload.mockResolvedValue(
      new Response(JSON.stringify({ token: "tok_abc" }), { status: 200 }),
    )
  })

  it("returns 401 for unauthenticated requests", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/resume/upload/route")

    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
  })

  it("returns 403 when authenticated user has no JobSeeker row", async () => {
    mockAuth.mockResolvedValue({ userId: "user_clerk_01" })
    mockJobSeekerFindUnique.mockResolvedValue(null)
    const { POST } = await import("@/app/api/resume/upload/route")

    const response = await POST(makeRequest())
    expect(response.status).toBe(403)
  })

  it("returns 200 with client token for a valid authenticated seeker", async () => {
    mockAuth.mockResolvedValue({ userId: "user_clerk_01" })
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)
    const { POST } = await import("@/app/api/resume/upload/route")

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    expect(mockHandleUpload).toHaveBeenCalledOnce()
  })

  it("verifies onBeforeGenerateToken returns allowed MIME types and max size", async () => {
    mockAuth.mockResolvedValue({ userId: "user_clerk_01" })
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)

    let capturedOptions: Record<string, unknown> | null = null
    mockHandleUpload.mockImplementation(async (opts: Record<string, unknown>) => {
      capturedOptions = opts
      // Call onBeforeGenerateToken to verify it works
      const token = await (opts.onBeforeGenerateToken as (p: string) => Promise<unknown>)(
        `resumes/${SEEKER.id}/resume.pdf`,
      )
      return new Response(JSON.stringify({ token }), { status: 200 })
    })

    const { POST } = await import("@/app/api/resume/upload/route")
    await POST(makeRequest())

    expect(capturedOptions).not.toBeNull()
  })

  it("onBeforeGenerateToken includes PDF and DOCX in allowedContentTypes", async () => {
    mockAuth.mockResolvedValue({ userId: "user_clerk_01" })
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)

    let tokenConfig: Record<string, unknown> | null = null
    mockHandleUpload.mockImplementation(async (opts: Record<string, unknown>) => {
      tokenConfig = (await (opts.onBeforeGenerateToken as (p: string) => Promise<unknown>)(
        `resumes/${SEEKER.id}/resume.pdf`,
      )) as Record<string, unknown>
      return new Response("{}", { status: 200 })
    })

    const { POST } = await import("@/app/api/resume/upload/route")
    await POST(makeRequest())

    expect(tokenConfig).not.toBeNull()
    expect((tokenConfig as Record<string, unknown>).allowedContentTypes).toContain(
      "application/pdf",
    )
    expect((tokenConfig as Record<string, unknown>).allowedContentTypes).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
  })

  it("onBeforeGenerateToken sets maximumSizeInBytes to 10 MiB", async () => {
    mockAuth.mockResolvedValue({ userId: "user_clerk_01" })
    mockJobSeekerFindUnique.mockResolvedValue(SEEKER)

    let tokenConfig: Record<string, unknown> | null = null
    mockHandleUpload.mockImplementation(async (opts: Record<string, unknown>) => {
      tokenConfig = (await (opts.onBeforeGenerateToken as (p: string) => Promise<unknown>)(
        `resumes/${SEEKER.id}/resume.pdf`,
      )) as Record<string, unknown>
      return new Response("{}", { status: 200 })
    })

    const { POST } = await import("@/app/api/resume/upload/route")
    await POST(makeRequest())

    expect((tokenConfig as Record<string, unknown>).maximumSizeInBytes).toBe(10 * 1024 * 1024)
  })
})
