import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { inngest } from "@/lib/inngest"

/**
 * Stripe webhook endpoint.
 * Verifies signature, then dispatches to Inngest for async processing.
 */
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 })
  }

  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"]
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Dispatch to Inngest for reliable async processing
  await inngest.send({
    name: "billing/stripe.webhook",
    data: {
      stripeEventId: event.id,
      type: event.type,
      payload: { object: event.data.object },
    },
  })

  return NextResponse.json({ received: true })
}
