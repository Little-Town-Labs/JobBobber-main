import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { deliverWebhook } from "@/lib/webhooks"
import type { PrismaClient } from "@prisma/client"

/**
 * Maps Stripe subscription status strings to our SubscriptionStatus enum.
 */
function mapStripeStatus(
  stripeStatus: string,
): "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "INCOMPLETE" {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE"
    case "past_due":
      return "PAST_DUE"
    case "canceled":
      return "EXPIRED"
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE"
    case "trialing":
      return "ACTIVE"
    case "unpaid":
      return "PAST_DUE"
    default:
      return "INCOMPLETE"
  }
}

interface StripeWebhookInput {
  stripeEventId: string
  type: string
  payload: Record<string, unknown>
}

interface ProcessResult {
  skipped?: boolean
  reason?: string
  processed?: boolean
}

/**
 * Core event processing logic — extracted for testability.
 * Called by the Inngest function handler.
 */
export async function processStripeWebhookEvent(
  prisma: PrismaClient,
  input: StripeWebhookInput,
): Promise<ProcessResult> {
  const { stripeEventId, type, payload } = input

  // Idempotency check
  const existing = await prisma.stripeEvent.findUnique({
    where: { stripeEventId },
  })
  if (existing?.processed) {
    return { skipped: true, reason: "already_processed" }
  }

  // Create event record
  const eventRecord = await prisma.stripeEvent.create({
    data: {
      stripeEventId,
      type,
      processed: false,
      payload: payload as never,
    },
  })

  // Route to handler
  const handler = STRIPE_EVENT_HANDLERS[type]
  if (handler) {
    await handler(prisma, payload)
  }

  // Mark processed
  await prisma.stripeEvent.update({
    where: { id: eventRecord.id },
    data: { processed: true, processedAt: new Date() },
  })

  return { processed: true }
}

/**
 * Handler for subscription lifecycle events (created, updated, deleted).
 */
async function handleSubscriptionEvent(
  prisma: PrismaClient,
  payload: Record<string, unknown>,
  statusOverride?: "EXPIRED",
) {
  const sub = (payload as { object: Record<string, unknown> }).object
  const subscriptionId = sub.id as string
  const customerId = sub.customer as string
  const metadata = sub.metadata as Record<string, string>
  const status = statusOverride ?? mapStripeStatus(sub.status as string)

  const data = {
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    userId: metadata.userId ?? "",
    userType: (metadata.userType as "JOB_SEEKER" | "EMPLOYER") ?? "JOB_SEEKER",
    planId: metadata.planId ?? "",
    status,
    currentPeriodStart: new Date((sub.current_period_start as number) * 1000),
    currentPeriodEnd: new Date((sub.current_period_end as number) * 1000),
    cancelAtPeriodEnd: (sub.cancel_at_period_end as boolean) ?? false,
  }

  // Link to employer or seeker if metadata provides it
  if (data.userType === "EMPLOYER" && metadata.employerId) {
    Object.assign(data, { employerId: metadata.employerId })
  }
  if (data.userType === "JOB_SEEKER" && metadata.seekerId) {
    Object.assign(data, { seekerId: metadata.seekerId })
  }

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    create: data,
    update: {
      status: data.status,
      planId: data.planId,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    },
  })

  if (data.userId) {
    const webhooks = await db.webhook.findMany({
      where: { ownerId: data.userId, active: true, events: { has: "SUBSCRIPTION_CHANGED" } },
    })
    if (webhooks.length > 0) {
      const payload = { userId: data.userId, planId: data.planId, status: data.status }
      await Promise.all(webhooks.map((wh) => deliverWebhook(wh, "SUBSCRIPTION_CHANGED", payload)))
    }
  }
}

/**
 * Handler for invoice.payment_failed — sets subscription to PAST_DUE.
 */
async function handlePaymentFailed(prisma: PrismaClient, payload: Record<string, unknown>) {
  const invoice = (payload as { object: Record<string, unknown> }).object
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: "PAST_DUE" },
  })
}

/**
 * Registered event handlers by Stripe event type.
 */
export const STRIPE_EVENT_HANDLERS: Record<
  string,
  (prisma: PrismaClient, payload: Record<string, unknown>) => Promise<void>
> = {
  "customer.subscription.created": (prisma, payload) => handleSubscriptionEvent(prisma, payload),
  "customer.subscription.updated": (prisma, payload) => handleSubscriptionEvent(prisma, payload),
  "customer.subscription.deleted": (prisma, payload) =>
    handleSubscriptionEvent(prisma, payload, "EXPIRED"),
  "invoice.payment_succeeded": async () => {
    // No-op: subscription status is updated via subscription.updated event
  },
  "invoice.payment_failed": (prisma, payload) => handlePaymentFailed(prisma, payload),
}

/**
 * Inngest function that processes Stripe webhook events.
 * Triggered by the webhook route dispatching a "billing/stripe.webhook" event.
 */
export const processStripeEvent = inngest.createFunction(
  {
    id: "process-stripe-event",
    retries: 3,
  },
  { event: "billing/stripe.webhook" },
  async ({ event, step }) => {
    const { stripeEventId, type, payload } = event.data as StripeWebhookInput

    return await step.run("process-event", async () => {
      // Extended Prisma client type is not assignable to base PrismaClient parameter
      return processStripeWebhookEvent(db as unknown as PrismaClient, {
        stripeEventId,
        type,
        payload,
      })
    })
  },
)
