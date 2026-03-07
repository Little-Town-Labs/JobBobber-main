import "server-only"
import { Webhook } from "svix"
import { headers } from "next/headers"
import { db } from "@/lib/db"

/**
 * Clerk webhook handler.
 *
 * Verifies the svix signature using CLERK_WEBHOOK_SECRET, then routes
 * each supported event type to the appropriate database operation.
 *
 * Supported events:
 *   user.created       → db.jobSeeker.upsert (stub — profile fields populated in Feature 3)
 *   organization.created → db.employer.upsert (stub — org fields populated in Feature 4)
 *   (all others)       → acknowledged (HTTP 200), not processed
 *
 * Security:
 *   - Returns HTTP 401 on invalid signature (no additional info leaked)
 *   - Returns HTTP 400 when required svix headers are absent
 */

interface ClerkUserCreatedEvent {
  type: "user.created"
  data: {
    id: string
    first_name?: string | null
    last_name?: string | null
    email_addresses?: Array<{ email_address: string }>
  }
}

interface ClerkOrgCreatedEvent {
  type: "organization.created"
  data: {
    id: string
    name: string
  }
}

type ClerkWebhookEvent =
  | ClerkUserCreatedEvent
  | ClerkOrgCreatedEvent
  | { type: string; data: unknown }

export async function POST(req: Request): Promise<Response> {
  const headersList = await headers()
  const svixId = headersList.get("svix-id")
  const svixTimestamp = headersList.get("svix-timestamp")
  const svixSignature = headersList.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  const webhookSecret = process.env["CLERK_WEBHOOK_SECRET"]
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 })
  }

  const body = await req.text()
  const wh = new Webhook(webhookSecret)

  let event: ClerkWebhookEvent
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return new Response("Invalid signature", { status: 401 })
  }

  switch (event.type) {
    case "user.created": {
      const { id, first_name, last_name } = event.data as ClerkUserCreatedEvent["data"]
      const displayName = [first_name, last_name].filter(Boolean).join(" ") || "New User"

      await db.jobSeeker.upsert({
        where: { clerkUserId: id },
        create: {
          clerkUserId: id,
          name: displayName,
          skills: [],
          urls: [],
          // TODO Feature 3: populate full profile fields from Clerk data
        },
        update: {},
      })
      break
    }

    case "organization.created": {
      const { id, name } = event.data as ClerkOrgCreatedEvent["data"]

      await db.employer.upsert({
        where: { clerkOrgId: id },
        create: {
          clerkOrgId: id,
          name,
          locations: [],
          benefits: [],
          urls: {},
          // TODO Feature 4: populate org fields from Clerk organization data
        },
        update: {},
      })
      break
    }

    default:
      // Unknown event type — acknowledge without processing
      break
  }

  return new Response("ok", { status: 200 })
}
