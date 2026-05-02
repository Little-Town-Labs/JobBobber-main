/**
 * webhooks.test.ts — TDD RED → GREEN for src/lib/webhooks.ts
 *
 * Tests cover:
 *  - generateWebhookSecret: format, uniqueness
 *  - signPayload: format, determinism, sensitivity to secret and payload
 *  - deliverWebhook: HTTP delivery, DB logging, metadata updates, return values
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Hoist mock factories so they are available before vi.mock() calls
// ---------------------------------------------------------------------------
const { mockDeliveryCreate, mockWebhookUpdate, mockFetch } = vi.hoisted(() => {
  const mockDeliveryCreate = vi.fn()
  const mockWebhookUpdate = vi.fn()
  const mockFetch = vi.fn()
  return { mockDeliveryCreate, mockWebhookUpdate, mockFetch }
})

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    webhookDelivery: {
      create: mockDeliveryCreate,
    },
    webhook: {
      update: mockWebhookUpdate,
    },
  },
}))

// Mock global fetch — deliverWebhook uses the built-in Node 18 fetch
vi.stubGlobal("fetch", mockFetch)

import { generateWebhookSecret, signPayload, deliverWebhook } from "@/lib/webhooks"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeWebhook = (overrides?: Partial<{ id: string; url: string; secret: string }>) => ({
  id: "webhook_123",
  url: "https://example.com/hooks",
  secret: "mysecret",
  ...overrides,
})

const makeOkResponse = (status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
})

// ---------------------------------------------------------------------------
// generateWebhookSecret
// ---------------------------------------------------------------------------
describe("generateWebhookSecret", () => {
  it("returns a 64-char hex string", () => {
    const secret = generateWebhookSecret()
    expect(secret).toHaveLength(64)
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
  })

  it("two calls return different values", () => {
    const first = generateWebhookSecret()
    const second = generateWebhookSecret()
    expect(first).not.toBe(second)
  })
})

// ---------------------------------------------------------------------------
// signPayload
// ---------------------------------------------------------------------------
describe("signPayload", () => {
  it('returns a string starting with "sha256="', () => {
    const sig = signPayload('{"event":"test"}', "secret")
    expect(sig.startsWith("sha256=")).toBe(true)
  })

  it("returns the same signature for the same payload + secret (deterministic)", () => {
    const payload = '{"event":"MATCH_CREATED"}'
    const secret = "stable-secret"
    expect(signPayload(payload, secret)).toBe(signPayload(payload, secret))
  })

  it("returns different signatures for different secrets", () => {
    const payload = '{"event":"MATCH_CREATED"}'
    expect(signPayload(payload, "secret-one")).not.toBe(signPayload(payload, "secret-two"))
  })

  it("returns different signatures for different payloads", () => {
    const secret = "same-secret"
    expect(signPayload('{"event":"A"}', secret)).not.toBe(signPayload('{"event":"B"}', secret))
  })
})

// ---------------------------------------------------------------------------
// deliverWebhook
// ---------------------------------------------------------------------------
describe("deliverWebhook", () => {
  const webhook = makeWebhook()
  const eventType = "MATCH_CREATED"
  const payload = { matchId: "match_abc", seekerId: "seeker_xyz" }

  beforeEach(() => {
    mockDeliveryCreate.mockReset()
    mockWebhookUpdate.mockReset()
    mockFetch.mockReset()

    mockDeliveryCreate.mockResolvedValue({})
    mockWebhookUpdate.mockResolvedValue({})
  })

  // ---- HTTP request shape --------------------------------------------------

  it("POSTs to the webhook URL with Content-Type: application/json", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    await deliverWebhook(webhook, eventType, payload)

    expect(mockFetch).toHaveBeenCalledOnce()
     
    const [url, init] = mockFetch.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe(webhook.url)
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
  })

  it("POSTs with X-JobBobber-Signature header containing sha256=<hmac>", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    await deliverWebhook(webhook, eventType, payload)

     
    const [, init] = mockFetch.mock.calls[0]! as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["X-JobBobber-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/)
  })

  it("POSTs with X-JobBobber-Event header set to the eventType", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    await deliverWebhook(webhook, eventType, payload)

     
    const [, init] = mockFetch.mock.calls[0]! as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers["X-JobBobber-Event"]).toBe(eventType)
  })

  // ---- DB delivery log — success ------------------------------------------

  it("writes a WebhookDelivery record with success:true on HTTP 200", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    await deliverWebhook(webhook, eventType, payload)

    expect(mockDeliveryCreate).toHaveBeenCalledOnce()
     
    const { data } = mockDeliveryCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data.webhookId).toBe(webhook.id)
    expect(data.eventType).toBe(eventType)
    expect(data.success).toBe(true)
    expect(data.statusCode).toBe(200)
    expect(data.attemptedAt).toBeInstanceOf(Date)
    expect(typeof data.durationMs).toBe("number")
  })

  // ---- DB delivery log — HTTP failure -------------------------------------

  it("writes a WebhookDelivery record with success:false on HTTP 500", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(500))

    await deliverWebhook(webhook, eventType, payload)

    expect(mockDeliveryCreate).toHaveBeenCalledOnce()
     
    const { data } = mockDeliveryCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data.success).toBe(false)
    expect(data.statusCode).toBe(500)
    expect(data.errorMessage).toBeDefined()
  })

  // ---- DB delivery log — network error ------------------------------------

  it("writes a WebhookDelivery record with success:false when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"))

    await deliverWebhook(webhook, eventType, payload)

    expect(mockDeliveryCreate).toHaveBeenCalledOnce()
     
    const { data } = mockDeliveryCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data.success).toBe(false)
    expect(data.statusCode).toBeNull()
    expect(data.errorMessage).toBe("ECONNREFUSED")
  })

  // ---- Return values -------------------------------------------------------

  it("returns { success: true, statusCode: 200 } on HTTP 200", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    const result = await deliverWebhook(webhook, eventType, payload)

    expect(result).toEqual({ success: true, statusCode: 200 })
  })

  it("returns { success: false, statusCode: 500 } on HTTP 500", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(500))

    const result = await deliverWebhook(webhook, eventType, payload)

    expect(result).toEqual({ success: false, statusCode: 500 })
  })

  it("returns { success: false, statusCode: null } on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const result = await deliverWebhook(webhook, eventType, payload)

    expect(result).toEqual({ success: false, statusCode: null })
  })

  // ---- Webhook metadata updates -------------------------------------------

  it("updates webhook.lastFiredAt after delivery", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    await deliverWebhook(webhook, eventType, payload)

    expect(mockWebhookUpdate).toHaveBeenCalledOnce()
     
    const { data } = mockWebhookUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data.lastFiredAt).toBeInstanceOf(Date)
  })

  it("increments failCount when delivery fails", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(500))

    await deliverWebhook(webhook, eventType, payload)

    expect(mockWebhookUpdate).toHaveBeenCalledOnce()
     
    const { data } = mockWebhookUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data.failCount).toEqual({ increment: 1 })
  })

  it("resets failCount to 0 on success", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    await deliverWebhook(webhook, eventType, payload)

    expect(mockWebhookUpdate).toHaveBeenCalledOnce()
     
    const { data } = mockWebhookUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data.failCount).toBe(0)
  })

  it("signature in header matches signPayload(body, secret)", async () => {
    mockFetch.mockResolvedValue(makeOkResponse(200))

    await deliverWebhook(webhook, eventType, payload)

     
    const [, init] = mockFetch.mock.calls[0]! as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    const body = init.body as string

    const expectedSig = signPayload(body, webhook.secret)
    expect(headers["X-JobBobber-Signature"]).toBe(expectedSig)
  })
})
