/**
 * Inngest functions for sending match-related email notifications.
 *
 * - notification/match.created: Notifies seeker of a new match
 * - notification/mutual.accept: Notifies both parties on mutual acceptance
 *
 * @see .specify/specs/6-match-dashboard/spec.md — US-6, FR-9, FR-10
 */
import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { deliverWebhook } from "@/lib/webhooks"
import { Resend } from "resend"
import { clerkClient } from "@clerk/nextjs/server"
import { env } from "@/lib/env"

function getResend() {
  return new Resend(env.RESEND_API_KEY)
}
const FROM_EMAIL = env.NOTIFICATION_FROM_EMAIL ?? "notifications@jobbobber.com"
const APP_URL = env.NEXT_PUBLIC_APP_URL

async function getClerkEmail(clerkUserId: string): Promise<string | null> {
  try {
    // Clerk v5 changed clerkClient from direct export to factory function
    const client = await (clerkClient as unknown as () => Promise<unknown>)()
    const c = client as {
      users: { getUser: (id: string) => Promise<{ emailAddresses: { emailAddress: string }[] }> }
    }
    const user = await c.users.getUser(clerkUserId)
    return user.emailAddresses[0]?.emailAddress ?? null
  } catch {
    return null
  }
}

function parseNotifPrefs(prefs: unknown): { matchCreated: boolean; mutualAccept: boolean } {
  const defaults = { matchCreated: true, mutualAccept: true }
  if (!prefs || typeof prefs !== "object") return defaults
  const p = prefs as Record<string, unknown>
  return {
    matchCreated: typeof p.matchCreated === "boolean" ? p.matchCreated : true,
    mutualAccept: typeof p.mutualAccept === "boolean" ? p.mutualAccept : true,
  }
}

async function sendEmail(
  resend: Resend,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
    return true
  } catch {
    return false
  }
}

export const sendMatchCreatedNotification = inngest.createFunction(
  { id: "send-match-created-notification" },
  { event: "notification/match.created" },
  async ({ event, step }) => {
    const { seekerId, jobPostingId, confidenceScore } = event.data as {
      matchId: string
      seekerId: string
      jobPostingId: string
      confidenceScore: string
    }

    const resend = getResend()

    const seeker = await step.run("lookup-seeker", () =>
      db.jobSeeker.findUnique({ where: { id: seekerId } }),
    )
    if (!seeker) return { status: "COMPLETED", emailSent: false }

    const posting = await step.run("lookup-posting", () =>
      db.jobPosting.findUnique({ where: { id: jobPostingId } }),
    )

    const settings = await step.run("check-prefs", () =>
      db.seekerSettings.findUnique({ where: { seekerId } }),
    )
    const prefs = parseNotifPrefs((settings as { notifPrefs?: unknown } | null)?.notifPrefs)
    if (!prefs.matchCreated) return { status: "COMPLETED", emailSent: false }

    const s = seeker as { userId?: string; clerkUserId?: string; name?: string }
    const email = await step.run("get-email", () => getClerkEmail(s.userId ?? s.clerkUserId ?? ""))
    if (!email) return { status: "COMPLETED", emailSent: false }

    const title = (posting as { title?: string } | null)?.title ?? "a position"
    const emailSent = await step.run("send-email", () =>
      sendEmail(
        resend,
        email,
        `New ${confidenceScore} match: ${title}`,
        `<p>Hi ${s.name ?? "there"},</p>
<p>You have a new <strong>${confidenceScore}</strong> match for <strong>${title}</strong>.</p>
<p><a href="${APP_URL}/matches">View your matches</a></p>`,
      ),
    )

    await step.run("post-webhooks", async () => {
      const webhooks = await db.webhook.findMany({
        where: { ownerId: seekerId, active: true, events: { has: "MATCH_CREATED" } },
      })
      const payload = {
        matchId: event.data.matchId,
        postingId: jobPostingId,
        seekerId,
        status: "CREATED",
      }
      await Promise.all(webhooks.map((wh) => deliverWebhook(wh, "MATCH_CREATED", payload)))
    })

    return { status: "COMPLETED", emailSent }
  },
)

export const sendMutualAcceptNotification = inngest.createFunction(
  { id: "send-mutual-accept-notification" },
  { event: "notification/mutual.accept" },
  async ({ event, step }) => {
    const { seekerId, employerId, jobPostingId } = event.data as {
      matchId: string
      seekerId: string
      employerId: string
      jobPostingId: string
    }

    const resend = getResend()

    const seeker = await step.run("lookup-seeker", () =>
      db.jobSeeker.findUnique({ where: { id: seekerId } }),
    )
    const employer = await step.run("lookup-employer", () =>
      db.employer.findUnique({ where: { id: employerId } }),
    )
    const posting = await step.run("lookup-posting", () =>
      db.jobPosting.findUnique({ where: { id: jobPostingId } }),
    )

    if (!seeker || !employer) return { status: "COMPLETED", emailsSent: 0 }

    const seekerSettings = await step.run("check-seeker-prefs", () =>
      db.seekerSettings.findUnique({ where: { seekerId } }),
    )

    // Prisma model name accessed dynamically — TypeScript can't verify at compile time
    const dbAny = db as unknown as Record<
      string,
      { findUnique: (args: unknown) => Promise<unknown> }
    >
    const employerSettings = await step.run("check-employer-prefs", async () => {
      if (dbAny.employerSettings) {
        return dbAny.employerSettings.findUnique({ where: { employerId } })
      }
      return employer
    })

    const seekerPrefs = parseNotifPrefs(
      (seekerSettings as { notifPrefs?: unknown } | null)?.notifPrefs,
    )
    const employerPrefs = parseNotifPrefs(
      (employerSettings as { notifPrefs?: unknown } | null)?.notifPrefs,
    )

    const title = (posting as { title?: string } | null)?.title ?? "a position"
    const s = seeker as { userId?: string; clerkUserId?: string; name?: string }
    const e = employer as { userId?: string; clerkUserId?: string }
    let emailsSent = 0

    if (seekerPrefs.mutualAccept) {
      const email = await step.run("get-seeker-email", () =>
        getClerkEmail(s.userId ?? s.clerkUserId ?? ""),
      )
      if (email) {
        const sent = await step.run("send-seeker-email", () =>
          sendEmail(
            resend,
            email,
            `Mutual match! ${title}`,
            `<p>Hi ${s.name ?? "there"},</p>
<p>Great news! Both you and the employer have accepted the match for <strong>${title}</strong>.</p>
<p><a href="${APP_URL}/matches">View match details</a></p>`,
          ),
        )
        if (sent) emailsSent++
      }
    }

    if (employerPrefs.mutualAccept) {
      const email = await step.run("get-employer-email", () =>
        getClerkEmail(e.userId ?? e.clerkUserId ?? ""),
      )
      if (email) {
        const sent = await step.run("send-employer-email", () =>
          sendEmail(
            resend,
            email,
            `Mutual match! ${title}`,
            `<p>A candidate has mutually accepted a match for <strong>${title}</strong>.</p>
<p><a href="${APP_URL}/postings">View match details</a></p>`,
          ),
        )
        if (sent) emailsSent++
      }
    }

    await step.run("post-webhooks", async () => {
      const payload = {
        matchId: event.data.matchId,
        postingId: jobPostingId,
        seekerId,
        employerId,
        status: "ACCEPTED",
      }
      const [seekerWebhooks, employerWebhooks] = await Promise.all([
        db.webhook.findMany({
          where: { ownerId: seekerId, active: true, events: { has: "MATCH_ACCEPTED" } },
        }),
        db.webhook.findMany({
          where: { ownerId: employerId, active: true, events: { has: "MATCH_ACCEPTED" } },
        }),
      ])
      await Promise.all([
        ...seekerWebhooks.map((wh) => deliverWebhook(wh, "MATCH_ACCEPTED", payload)),
        ...employerWebhooks.map((wh) => deliverWebhook(wh, "MATCH_ACCEPTED", payload)),
      ])
    })

    return { status: "COMPLETED", emailsSent }
  },
)
