import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { inngest } from "@/lib/inngest"
import { env } from "@/lib/env"

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 })
  }

  let event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

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
