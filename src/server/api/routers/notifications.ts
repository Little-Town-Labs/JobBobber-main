/**
 * Notifications router — notification preferences for seekers and employers.
 *
 * @see .specify/specs/6-match-dashboard/spec.md — US-7, FR-11
 */
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"

const DEFAULT_PREFS = { matchCreated: true, mutualAccept: true }

const prefsSchema = z.object({
  matchCreated: z.boolean().default(true),
  mutualAccept: z.boolean().default(true),
})

function parsePrefs(raw: unknown): { matchCreated: boolean; mutualAccept: boolean } {
  const parsed = prefsSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_PREFS
}

export const notificationsRouter = createTRPCRouter({
  getNotifPrefs: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.userRole === "JOB_SEEKER") {
      const seeker = await ctx.db.jobSeeker.findUnique({
        where: { clerkUserId: ctx.userId },
      })
      if (!seeker) return DEFAULT_PREFS

      const settings = await ctx.db.seekerSettings.findUnique({
        where: { seekerId: seeker.id },
      })
      return parsePrefs(settings?.notifPrefs)
    }

    // Employer
    if (ctx.orgId) {
      const employer = await ctx.db.employer.findUnique({
        where: { clerkOrgId: ctx.orgId },
      })
      return parsePrefs(employer?.notifPrefs)
    }

    return DEFAULT_PREFS
  }),

  updateNotifPrefs: protectedProcedure
    .input(
      z.object({
        matchCreated: z.boolean().optional(),
        mutualAccept: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.userRole === "JOB_SEEKER") {
        const seeker = await ctx.db.jobSeeker.findUnique({
          where: { clerkUserId: ctx.userId },
        })
        if (!seeker) return DEFAULT_PREFS

        const settings = await ctx.db.seekerSettings.findUnique({
          where: { seekerId: seeker.id },
        })
        const current = parsePrefs(settings?.notifPrefs)
        const updated = {
          matchCreated: input.matchCreated ?? current.matchCreated,
          mutualAccept: input.mutualAccept ?? current.mutualAccept,
        }

        const result = await ctx.db.seekerSettings.update({
          where: { seekerId: seeker.id },
          data: { notifPrefs: updated },
        })
        return parsePrefs(result.notifPrefs)
      }

      // Employer
      if (ctx.orgId) {
        const employer = await ctx.db.employer.findUnique({
          where: { clerkOrgId: ctx.orgId },
        })
        if (!employer) return DEFAULT_PREFS

        const current = parsePrefs(employer.notifPrefs)
        const updated = {
          matchCreated: input.matchCreated ?? current.matchCreated,
          mutualAccept: input.mutualAccept ?? current.mutualAccept,
        }

        const result = await ctx.db.employer.update({
          where: { id: employer.id },
          data: { notifPrefs: updated },
        })
        return parsePrefs(result.notifPrefs)
      }

      return DEFAULT_PREFS
    }),
})
