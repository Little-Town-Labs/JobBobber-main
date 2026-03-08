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
 *   user.created                      → db.jobSeeker.upsert
 *   organization.created              → db.employer.upsert
 *   organizationMembership.created    → db.employerMember.upsert (Feature 13)
 *   organizationMembership.deleted    → db.employerMember.deleteMany (Feature 13)
 *   organizationInvitation.accepted   → db.invitation.updateMany (Feature 13)
 *   (all others)                      → acknowledged (HTTP 200), not processed
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

interface ClerkOrgMembershipCreatedEvent {
  type: "organizationMembership.created"
  data: {
    organization: { id: string }
    public_user_data: { user_id: string }
    role: string
  }
}

interface ClerkOrgMembershipDeletedEvent {
  type: "organizationMembership.deleted"
  data: {
    organization: { id: string }
    public_user_data: { user_id: string }
  }
}

interface ClerkOrgInvitationAcceptedEvent {
  type: "organizationInvitation.accepted"
  data: {
    id: string
    organization: { id: string }
    email_address: string
  }
}

type ClerkWebhookEvent =
  | ClerkUserCreatedEvent
  | ClerkOrgCreatedEvent
  | ClerkOrgMembershipCreatedEvent
  | ClerkOrgMembershipDeletedEvent
  | ClerkOrgInvitationAcceptedEvent
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

    case "organizationMembership.created": {
      const { organization, public_user_data, role } =
        event.data as ClerkOrgMembershipCreatedEvent["data"]
      const employer = await db.employer.findUnique({
        where: { clerkOrgId: organization.id },
      })
      if (employer) {
        const dbRole = role === "org:admin" ? "ADMIN" : "VIEWER"
        await db.employerMember.upsert({
          where: {
            employerId_clerkUserId: {
              employerId: employer.id,
              clerkUserId: public_user_data.user_id,
            },
          },
          create: {
            employerId: employer.id,
            clerkUserId: public_user_data.user_id,
            role: dbRole,
          },
          update: {},
        })
      }
      break
    }

    case "organizationMembership.deleted": {
      const { organization, public_user_data } =
        event.data as ClerkOrgMembershipDeletedEvent["data"]
      const employer = await db.employer.findUnique({
        where: { clerkOrgId: organization.id },
      })
      if (employer) {
        await db.employerMember.deleteMany({
          where: {
            employerId: employer.id,
            clerkUserId: public_user_data.user_id,
          },
        })
      }
      break
    }

    case "organizationInvitation.accepted": {
      const { id: clerkInvitationId } = event.data as ClerkOrgInvitationAcceptedEvent["data"]
      await db.invitation.updateMany({
        where: { clerkInvitationId, status: "PENDING" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      })
      break
    }

    default:
      // Unknown event type — acknowledge without processing
      break
  }

  return new Response("ok", { status: 200 })
}
