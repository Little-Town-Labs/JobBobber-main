import { describe, it, expect, vi, beforeEach } from "vitest"

// Use vi.hoisted so mocks are available in vi.mock factories
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    stripeEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    employer: {
      update: vi.fn(),
    },
    jobSeeker: {
      update: vi.fn(),
    },
    webhook: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/webhooks", () => ({
  deliverWebhook: vi.fn().mockResolvedValue({ success: true, statusCode: 200 }),
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: unknown) => handler),
  },
}))

import { processStripeWebhookEvent, STRIPE_EVENT_HANDLERS } from "./process-stripe-event"
import { deliverWebhook } from "@/lib/webhooks"

const mockDeliverWebhook = vi.mocked(deliverWebhook)

describe("process-stripe-event", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.webhook.findMany.mockResolvedValue([])
  })

  describe("idempotency", () => {
    it("skips processing if event already exists and is processed", async () => {
      mockDb.stripeEvent.findUnique.mockResolvedValue({
        id: "evt_1",
        stripeEventId: "evt_stripe_123",
        processed: true,
      })

      const result = await processStripeWebhookEvent(mockDb as never, {
        stripeEventId: "evt_stripe_123",
        type: "customer.subscription.created",
        payload: {},
      })

      expect(result).toEqual({ skipped: true, reason: "already_processed" })
      expect(mockDb.subscription.upsert).not.toHaveBeenCalled()
    })

    it("creates StripeEvent record for new events", async () => {
      mockDb.stripeEvent.findUnique.mockResolvedValue(null)
      mockDb.stripeEvent.create.mockResolvedValue({ id: "internal_1" })
      mockDb.stripeEvent.update.mockResolvedValue({})
      mockDb.subscription.upsert.mockResolvedValue({})

      await processStripeWebhookEvent(mockDb as never, {
        stripeEventId: "evt_stripe_new",
        type: "customer.subscription.created",
        payload: makeSubscriptionEvent("sub_1", "cus_1", "active"),
      })

      expect(mockDb.stripeEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripeEventId: "evt_stripe_new",
          type: "customer.subscription.created",
          processed: false,
        }),
      })
    })
  })

  describe("event routing", () => {
    it("handles customer.subscription.created", () => {
      expect(STRIPE_EVENT_HANDLERS["customer.subscription.created"]).toBeDefined()
    })

    it("handles customer.subscription.updated", () => {
      expect(STRIPE_EVENT_HANDLERS["customer.subscription.updated"]).toBeDefined()
    })

    it("handles customer.subscription.deleted", () => {
      expect(STRIPE_EVENT_HANDLERS["customer.subscription.deleted"]).toBeDefined()
    })

    it("handles invoice.payment_succeeded", () => {
      expect(STRIPE_EVENT_HANDLERS["invoice.payment_succeeded"]).toBeDefined()
    })

    it("handles invoice.payment_failed", () => {
      expect(STRIPE_EVENT_HANDLERS["invoice.payment_failed"]).toBeDefined()
    })
  })

  describe("subscription.created", () => {
    it("creates subscription record from webhook event", async () => {
      mockDb.stripeEvent.findUnique.mockResolvedValue(null)
      mockDb.stripeEvent.create.mockResolvedValue({ id: "internal_1" })
      mockDb.stripeEvent.update.mockResolvedValue({})
      mockDb.subscription.upsert.mockResolvedValue({})

      await processStripeWebhookEvent(mockDb as never, {
        stripeEventId: "evt_1",
        type: "customer.subscription.created",
        payload: makeSubscriptionEvent("sub_1", "cus_1", "active", {
          planId: "seeker_pro",
          userId: "user_1",
          userType: "JOB_SEEKER",
        }),
      })

      expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: "sub_1" },
          create: expect.objectContaining({
            stripeSubscriptionId: "sub_1",
            stripeCustomerId: "cus_1",
            status: "ACTIVE",
            planId: "seeker_pro",
          }),
        }),
      )
    })
  })

  describe("subscription.updated", () => {
    it("updates subscription status", async () => {
      mockDb.stripeEvent.findUnique.mockResolvedValue(null)
      mockDb.stripeEvent.create.mockResolvedValue({ id: "internal_1" })
      mockDb.stripeEvent.update.mockResolvedValue({})
      mockDb.subscription.upsert.mockResolvedValue({})

      await processStripeWebhookEvent(mockDb as never, {
        stripeEventId: "evt_2",
        type: "customer.subscription.updated",
        payload: makeSubscriptionEvent("sub_1", "cus_1", "past_due", {
          planId: "seeker_pro",
          userId: "user_1",
          userType: "JOB_SEEKER",
          cancelAtPeriodEnd: true,
        }),
      })

      expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: "PAST_DUE",
            cancelAtPeriodEnd: true,
          }),
        }),
      )
    })
  })

  describe("subscription.deleted", () => {
    it("marks subscription as expired", async () => {
      mockDb.stripeEvent.findUnique.mockResolvedValue(null)
      mockDb.stripeEvent.create.mockResolvedValue({ id: "internal_1" })
      mockDb.stripeEvent.update.mockResolvedValue({})
      mockDb.subscription.upsert.mockResolvedValue({})

      await processStripeWebhookEvent(mockDb as never, {
        stripeEventId: "evt_3",
        type: "customer.subscription.deleted",
        payload: makeSubscriptionEvent("sub_1", "cus_1", "canceled", {
          planId: "seeker_pro",
          userId: "user_1",
          userType: "JOB_SEEKER",
        }),
      })

      expect(mockDb.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: "EXPIRED",
          }),
        }),
      )
    })
  })

  describe("invoice.payment_failed", () => {
    it("updates subscription to PAST_DUE on payment failure", async () => {
      mockDb.stripeEvent.findUnique.mockResolvedValue(null)
      mockDb.stripeEvent.create.mockResolvedValue({ id: "internal_1" })
      mockDb.stripeEvent.update.mockResolvedValue({})
      mockDb.subscription.update.mockResolvedValue({})

      await processStripeWebhookEvent(mockDb as never, {
        stripeEventId: "evt_4",
        type: "invoice.payment_failed",
        payload: makeInvoiceEvent("sub_1", "cus_1"),
      })

      expect(mockDb.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: "sub_1" },
        data: { status: "PAST_DUE" },
      })
    })
  })

  describe("marks event processed", () => {
    it("sets processed=true and processedAt after handling", async () => {
      mockDb.stripeEvent.findUnique.mockResolvedValue(null)
      mockDb.stripeEvent.create.mockResolvedValue({ id: "internal_1" })
      mockDb.stripeEvent.update.mockResolvedValue({})
      mockDb.subscription.upsert.mockResolvedValue({})

      await processStripeWebhookEvent(mockDb as never, {
        stripeEventId: "evt_done",
        type: "customer.subscription.created",
        payload: makeSubscriptionEvent("sub_1", "cus_1", "active", {
          planId: "seeker_pro",
          userId: "user_1",
          userType: "JOB_SEEKER",
        }),
      })

      expect(mockDb.stripeEvent.update).toHaveBeenCalledWith({
        where: { id: "internal_1" },
        data: {
          processed: true,
          processedAt: expect.any(Date),
        },
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeSubscriptionEvent(
  subscriptionId: string,
  customerId: string,
  status: string,
  metadata?: { planId?: string; userId?: string; userType?: string; cancelAtPeriodEnd?: boolean },
) {
  return {
    object: {
      id: subscriptionId,
      customer: customerId,
      status,
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      cancel_at_period_end: metadata?.cancelAtPeriodEnd ?? false,
      metadata: {
        planId: metadata?.planId ?? "seeker_pro",
        userId: metadata?.userId ?? "user_1",
        userType: metadata?.userType ?? "JOB_SEEKER",
      },
    },
  }
}

function makeInvoiceEvent(subscriptionId: string, customerId: string) {
  return {
    object: {
      subscription: subscriptionId,
      customer: customerId,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests: webhook delivery — SUBSCRIPTION_CHANGED
// ---------------------------------------------------------------------------

describe("process-stripe-event: webhook delivery for SUBSCRIPTION_CHANGED", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.webhook.findMany.mockResolvedValue([])
    mockDb.stripeEvent.findUnique.mockResolvedValue(null)
    mockDb.stripeEvent.create.mockResolvedValue({ id: "internal_1" })
    mockDb.stripeEvent.update.mockResolvedValue({})
    mockDb.subscription.upsert.mockResolvedValue({})
  })

  it("fires SUBSCRIPTION_CHANGED webhook to the affected user's registered webhooks", async () => {
    const mockWebhook = { id: "wh-1", url: "https://example.com/hook", secret: "s3cr3t" }
    mockDb.webhook.findMany.mockResolvedValue([mockWebhook])

    await processStripeWebhookEvent(mockDb as never, {
      stripeEventId: "evt_wh_1",
      type: "customer.subscription.updated",
      payload: makeSubscriptionEvent("sub_1", "cus_1", "active", {
        planId: "seeker_pro",
        userId: "user_1",
        userType: "JOB_SEEKER",
      }),
    })

    expect(mockDeliverWebhook).toHaveBeenCalledWith(
      mockWebhook,
      "SUBSCRIPTION_CHANGED",
      expect.objectContaining({ userId: "user_1", planId: "seeker_pro" }),
    )
  })

  it("does not fire webhooks when no active SUBSCRIPTION_CHANGED subscriptions exist", async () => {
    mockDb.webhook.findMany.mockResolvedValue([])

    await processStripeWebhookEvent(mockDb as never, {
      stripeEventId: "evt_wh_2",
      type: "customer.subscription.updated",
      payload: makeSubscriptionEvent("sub_1", "cus_1", "active", {
        planId: "seeker_pro",
        userId: "user_1",
        userType: "JOB_SEEKER",
      }),
    })

    expect(mockDeliverWebhook).not.toHaveBeenCalled()
  })

  it("fires SUBSCRIPTION_CHANGED on subscription deletion (status EXPIRED)", async () => {
    const mockWebhook = { id: "wh-2", url: "https://example.com/hook", secret: "abc" }
    mockDb.webhook.findMany.mockResolvedValue([mockWebhook])

    await processStripeWebhookEvent(mockDb as never, {
      stripeEventId: "evt_wh_3",
      type: "customer.subscription.deleted",
      payload: makeSubscriptionEvent("sub_2", "cus_1", "canceled", {
        planId: "seeker_pro",
        userId: "user_2",
        userType: "JOB_SEEKER",
      }),
    })

    expect(mockDeliverWebhook).toHaveBeenCalledWith(
      mockWebhook,
      "SUBSCRIPTION_CHANGED",
      expect.objectContaining({ userId: "user_2", status: "EXPIRED" }),
    )
  })
})
