/**
 * webhooks tRPC router unit tests (TDD: written first).
 *
 * Tests create, list, delete, and test procedures.
 * All Prisma calls, webhooks utilities, and encryption are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// First test cold-starts dynamic imports (~8–15s on WSL under full-suite load)
vi.setConfig({ testTimeout: 30_000 })

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  webhook: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))
vi.mock("@/lib/inngest", () => ({ inngest: {} }))

const mockGenerateWebhookSecret = vi.hoisted(() => vi.fn())
const mockDeliverWebhook = vi.hoisted(() => vi.fn())

vi.mock("@/lib/webhooks", () => ({
  generateWebhookSecret: mockGenerateWebhookSecret,
  signPayload: vi.fn(),
  deliverWebhook: mockDeliverWebhook,
  assertSafeWebhookUrl: vi.fn().mockResolvedValue(undefined),
}))

const mockEncrypt = vi.hoisted(() => vi.fn())
const mockDecrypt = vi.hoisted(() => vi.fn())

vi.mock("@/lib/encryption", () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}))

// ---------------------------------------------------------------------------
// Helper: create tRPC caller
// ---------------------------------------------------------------------------

async function makeCaller(role: "JOB_SEEKER" | "EMPLOYER" = "JOB_SEEKER") {
  const { createCallerFactory, createTRPCRouter } = await import("@/server/api/trpc")
  const { webhooksRouter } = await import("./webhooks")

  return createCallerFactory(createTRPCRouter({ webhooks: webhooksRouter }))({
    db: mockDb as never,
    inngest: null as never,
    userId: "user_01",
    orgId: role === "EMPLOYER" ? "org_01" : null,
    orgRole: role === "EMPLOYER" ? "org:admin" : null,
    userRole: role,
  } as never)
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeWebhookRecord(
  overrides: Partial<{
    id: string
    url: string
    events: string[]
    secret: string
    ownerId: string
    ownerType: "SEEKER" | "EMPLOYER"
    active: boolean
    createdAt: Date
    lastFiredAt: Date | null
    failCount: number
  }> = {},
) {
  return {
    id: overrides.id ?? "wh_01",
    url: overrides.url ?? "https://example.com/webhook",
    events: overrides.events ?? ["MATCH_CREATED"],
    secret: overrides.secret ?? "encrypted_secret_value",
    ownerId: overrides.ownerId ?? "user_01",
    ownerType: overrides.ownerType ?? "SEEKER",
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-01-15T00:00:00Z"),
    lastFiredAt: overrides.lastFiredAt ?? null,
    failCount: overrides.failCount ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("webhooks router", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateWebhookSecret.mockReturnValue("raw_secret_hex_value")
    mockEncrypt.mockResolvedValue("encrypted_secret_value")
    mockDecrypt.mockResolvedValue("raw_secret_hex_value")
    mockDb.webhook.count.mockResolvedValue(0)
    mockDb.webhook.create.mockResolvedValue(makeWebhookRecord())
    mockDeliverWebhook.mockResolvedValue({ success: true, statusCode: 200 })
  })

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe("webhooks.create", () => {
    it("returns { id, url, events, secret, createdAt } — secret shown once", async () => {
      const caller = await makeCaller()
      const result = await caller.webhooks.create({
        url: "https://example.com/webhook",
        events: ["MATCH_CREATED"],
      })

      expect(result).toMatchObject({
        id: "wh_01",
        url: "https://example.com/webhook",
        events: ["MATCH_CREATED"],
        secret: "raw_secret_hex_value",
      })
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it("validates URL is HTTPS — rejects http://", async () => {
      const caller = await makeCaller()
      await expect(
        caller.webhooks.create({
          url: "http://example.com/webhook",
          events: ["MATCH_CREATED"],
        }),
      ).rejects.toThrow()
    })

    it("rejects empty events array", async () => {
      const caller = await makeCaller()
      await expect(
        caller.webhooks.create({
          url: "https://example.com/webhook",
          events: [],
        }),
      ).rejects.toThrow()
    })

    it("throws BAD_REQUEST when caller already has 5 active webhooks", async () => {
      mockDb.webhook.count.mockResolvedValue(5)

      const caller = await makeCaller()
      await expect(
        caller.webhooks.create({
          url: "https://example.com/webhook",
          events: ["MATCH_CREATED"],
        }),
      ).rejects.toThrow("Maximum 5 active webhooks allowed")
    })

    it("stores secret encrypted — plaintext secret not persisted to DB", async () => {
      const caller = await makeCaller()
      await caller.webhooks.create({
        url: "https://example.com/webhook",
        events: ["MATCH_CREATED"],
      })

      expect(mockEncrypt).toHaveBeenCalled()
      const createCall = mockDb.webhook.create.mock.calls[0]![0] as {
        data: Record<string, unknown>
      }
      // The raw secret must not appear in the DB write
      expect(createCall.data.secret).toBe("encrypted_secret_value")
      expect(createCall.data.secret).not.toBe("raw_secret_hex_value")
    })

    it("sets ownerId from ctx.userId and ownerType SEEKER for JOB_SEEKER", async () => {
      const caller = await makeCaller("JOB_SEEKER")
      await caller.webhooks.create({
        url: "https://example.com/webhook",
        events: ["MATCH_CREATED"],
      })

      const createCall = mockDb.webhook.create.mock.calls[0]![0] as {
        data: Record<string, unknown>
      }
      expect(createCall.data.ownerId).toBe("user_01")
      expect(createCall.data.ownerType).toBe("SEEKER")
    })

    it("sets ownerType EMPLOYER for EMPLOYER role", async () => {
      mockDb.webhook.create.mockResolvedValue(makeWebhookRecord({ ownerType: "EMPLOYER" }))
      const caller = await makeCaller("EMPLOYER")
      await caller.webhooks.create({
        url: "https://example.com/webhook",
        events: ["MATCH_CREATED"],
      })

      const createCall = mockDb.webhook.create.mock.calls[0]![0] as {
        data: Record<string, unknown>
      }
      expect(createCall.data.ownerType).toBe("EMPLOYER")
    })
  })

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe("webhooks.list", () => {
    it("returns only active webhooks for caller", async () => {
      mockDb.webhook.findMany.mockResolvedValue([
        makeWebhookRecord({ id: "wh_01", url: "https://a.com/hook", events: ["MATCH_CREATED"] }),
        makeWebhookRecord({ id: "wh_02", url: "https://b.com/hook", events: ["MATCH_ACCEPTED"] }),
      ])

      const caller = await makeCaller()
      const result = await caller.webhooks.list()

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ id: "wh_01", url: "https://a.com/hook" })
      expect(result[1]).toMatchObject({ id: "wh_02", url: "https://b.com/hook" })

      const findCall = mockDb.webhook.findMany.mock.calls[0]![0] as {
        where: { ownerId: string; active: boolean }
      }
      expect(findCall.where.ownerId).toBe("user_01")
      expect(findCall.where.active).toBe(true)
    })

    it("does NOT include secret in response", async () => {
      mockDb.webhook.findMany.mockResolvedValue([makeWebhookRecord({ id: "wh_01" })])

      const caller = await makeCaller()
      const result = await caller.webhooks.list()

      expect(result[0]).not.toHaveProperty("secret")
    })

    it("returns empty array when no webhooks", async () => {
      mockDb.webhook.findMany.mockResolvedValue([])

      const caller = await makeCaller()
      const result = await caller.webhooks.list()

      expect(result).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe("webhooks.delete", () => {
    it("sets active: false on the webhook", async () => {
      mockDb.webhook.findUnique.mockResolvedValue(makeWebhookRecord({ id: "wh_01" }))
      mockDb.webhook.update.mockResolvedValue(makeWebhookRecord({ id: "wh_01", active: false }))

      const caller = await makeCaller()
      const result = await caller.webhooks.delete({ webhookId: "wh_01" })

      expect(result).toEqual({ success: true })
      expect(mockDb.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wh_01" },
          data: expect.objectContaining({ active: false }),
        }),
      )
    })

    it("throws NOT_FOUND for unknown webhookId", async () => {
      mockDb.webhook.findUnique.mockResolvedValue(null)

      const caller = await makeCaller()
      await expect(caller.webhooks.delete({ webhookId: "missing_wh" })).rejects.toThrow(
        "Webhook not found",
      )
    })

    it("throws NOT_FOUND if webhookId belongs to different user", async () => {
      mockDb.webhook.findUnique.mockResolvedValue(
        makeWebhookRecord({ id: "wh_01", ownerId: "other_user" }),
      )

      const caller = await makeCaller()
      await expect(caller.webhooks.delete({ webhookId: "wh_01" })).rejects.toThrow(
        "Webhook not found",
      )
    })
  })

  // -------------------------------------------------------------------------
  // test
  // -------------------------------------------------------------------------

  describe("webhooks.test", () => {
    it("calls deliverWebhook with a test payload and returns { success: true }", async () => {
      mockDb.webhook.findUnique.mockResolvedValue(
        makeWebhookRecord({ id: "wh_01", url: "https://example.com/webhook" }),
      )
      mockDeliverWebhook.mockResolvedValue({ success: true, statusCode: 200 })

      const caller = await makeCaller()
      const result = await caller.webhooks.test({ webhookId: "wh_01" })

      expect(result).toEqual({ success: true, statusCode: 200 })
      expect(mockDeliverWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ id: "wh_01", url: "https://example.com/webhook" }),
        "MATCH_CREATED",
        expect.objectContaining({ test: true, webhookId: "wh_01" }),
      )
    })

    it("returns { success: false } when delivery fails", async () => {
      mockDb.webhook.findUnique.mockResolvedValue(makeWebhookRecord({ id: "wh_01" }))
      mockDeliverWebhook.mockResolvedValue({ success: false, statusCode: 500 })

      const caller = await makeCaller()
      const result = await caller.webhooks.test({ webhookId: "wh_01" })

      expect(result).toEqual({ success: false, statusCode: 500 })
    })

    it("throws NOT_FOUND for unknown webhookId", async () => {
      mockDb.webhook.findUnique.mockResolvedValue(null)

      const caller = await makeCaller()
      await expect(caller.webhooks.test({ webhookId: "missing_wh" })).rejects.toThrow(
        "Webhook not found",
      )
    })

    it("throws NOT_FOUND if webhook belongs to different user", async () => {
      mockDb.webhook.findUnique.mockResolvedValue(
        makeWebhookRecord({ id: "wh_01", ownerId: "other_user" }),
      )

      const caller = await makeCaller()
      await expect(caller.webhooks.test({ webhookId: "wh_01" })).rejects.toThrow(
        "Webhook not found",
      )
    })
  })
})
