/**
 * T4.2T — Clerk webhook handler tests
 *
 * Validates the signature verification and event routing in
 * src/app/api/webhooks/clerk/route.ts.
 *
 * Mocks: svix Webhook.verify(), db.jobSeeker.upsert(), db.employer.upsert()
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerify = vi.fn()

vi.mock("svix", () => ({
  Webhook: class MockWebhook {
    verify = mockVerify
  },
}))

const mockJobSeekerUpsert = vi.fn()
const mockEmployerUpsert = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    jobSeeker: { upsert: mockJobSeekerUpsert },
    employer: { upsert: mockEmployerUpsert },
  },
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null, orgId: null, orgRole: null }),
}))

vi.mock("@/lib/inngest", () => ({ inngest: {} }))

// next/headers requires App Router request scope. Mock it to extract
// headers from the global test request instead.
let currentTestRequest: Request | null = null
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => {
    if (!currentTestRequest) throw new Error("No test request set")
    return currentTestRequest.headers
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/webhooks/clerk", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "svix-id": "msg_test",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": "v1,valid_sig",
      ...headers,
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Clerk webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env["CLERK_WEBHOOK_SECRET"] = "whsec_test_secret_value"
  })

  it("returns HTTP 400 when svix headers are missing", async () => {
    const { POST } = await import("@/app/api/webhooks/clerk/route")

    const req = new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({ type: "user.created" }),
      headers: { "content-type": "application/json" },
      // No svix-id, svix-timestamp, svix-signature
    })
    currentTestRequest = req

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns HTTP 401 when svix signature verification fails", async () => {
    mockVerify.mockImplementationOnce(() => {
      throw new Error("invalid signature")
    })

    const { POST } = await import("@/app/api/webhooks/clerk/route")
    const req = makeRequest(JSON.stringify({ type: "user.created", data: {} }))
    currentTestRequest = req

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("calls db.jobSeeker.upsert on valid user.created event", async () => {
    const payload = {
      type: "user.created",
      data: {
        id: "user_test_123",
        first_name: "Alice",
        last_name: "Test",
        email_addresses: [{ email_address: "alice@example.com" }],
      },
    }
    mockVerify.mockReturnValueOnce(payload)
    mockJobSeekerUpsert.mockResolvedValueOnce({ id: "seeker_01" })

    const { POST } = await import("@/app/api/webhooks/clerk/route")
    const req = makeRequest(JSON.stringify(payload))
    currentTestRequest = req

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockJobSeekerUpsert).toHaveBeenCalledOnce()
    expect(mockJobSeekerUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { clerkUserId: "user_test_123" },
    })
  })

  it("calls db.employer.upsert on valid organization.created event", async () => {
    const payload = {
      type: "organization.created",
      data: {
        id: "org_test_456",
        name: "Acme Corp",
      },
    }
    mockVerify.mockReturnValueOnce(payload)
    mockEmployerUpsert.mockResolvedValueOnce({ id: "emp_01" })

    const { POST } = await import("@/app/api/webhooks/clerk/route")
    const req = makeRequest(JSON.stringify(payload))
    currentTestRequest = req

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockEmployerUpsert).toHaveBeenCalledOnce()
    expect(mockEmployerUpsert.mock.calls[0]?.[0]).toMatchObject({
      where: { clerkOrgId: "org_test_456" },
    })
  })

  it("returns HTTP 200 for unknown event types (acknowledged, not processed)", async () => {
    const payload = { type: "user.deleted", data: { id: "user_gone" } }
    mockVerify.mockReturnValueOnce(payload)

    const { POST } = await import("@/app/api/webhooks/clerk/route")
    const req = makeRequest(JSON.stringify(payload))
    currentTestRequest = req

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockJobSeekerUpsert).not.toHaveBeenCalled()
    expect(mockEmployerUpsert).not.toHaveBeenCalled()
  })
})
