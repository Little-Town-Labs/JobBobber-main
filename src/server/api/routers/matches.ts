/**
 * Matches router — viewing and acting on AI-generated match recommendations.
 *
 * @see .specify/specs/5-basic-ai-matching/spec.md
 */
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  createTRPCRouter,
  protectedProcedure,
  seekerProcedure,
  employerProcedure,
} from "@/server/api/trpc"
import { toMatchResponse } from "@/server/api/helpers/match-mapper"

export const matchesRouter = createTRPCRouter({
  /** List matches for a specific job posting (employer view) */
  listForPosting: employerProcedure
    .input(
      z.object({
        jobPostingId: z.string().min(1),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify employer owns the posting
      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }

      const items = await ctx.db.match.findMany({
        where: { jobPostingId: input.jobPostingId },
        orderBy: { confidenceScore: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      })
      const hasMore = items.length > input.limit
      const resultItems = hasMore ? items.slice(0, input.limit) : items
      return {
        items: resultItems.map(toMatchResponse),
        nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
        hasMore,
      }
    }),

  /** List matches for the authenticated seeker */
  listForSeeker: seekerProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit = 20 } = input ?? {}
      const items = await ctx.db.match.findMany({
        where: { seekerId: ctx.seeker.id },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      const hasMore = items.length > limit
      const resultItems = hasMore ? items.slice(0, limit) : items
      return {
        items: resultItems.map(toMatchResponse),
        nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
        hasMore,
      }
    }),

  /** Get a single match by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const match = await ctx.db.match.findUnique({ where: { id: input.id } })
      if (!match) return null

      // Ownership check: must be the seeker or the employer
      const isSeeker = ctx.userRole === "JOB_SEEKER"
      const isEmployer = ctx.userRole === "EMPLOYER"

      if (isSeeker) {
        const seeker = await ctx.db.jobSeeker.findUnique({
          where: { clerkUserId: ctx.userId },
        })
        if (!seeker || seeker.id !== match.seekerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
        }
      } else if (isEmployer && ctx.orgId) {
        const employer = await ctx.db.employer.findUnique({
          where: { clerkOrgId: ctx.orgId },
        })
        if (!employer || employer.id !== match.employerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
        }
      } else {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
      }

      return toMatchResponse(match)
    }),

  /** Accept or decline a match (for either party) */
  updateStatus: protectedProcedure
    .input(
      z.object({
        matchId: z.string().min(1),
        status: z.enum(["ACCEPTED", "DECLINED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.match.findUnique({ where: { id: input.matchId } })
      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
      }

      const isSeeker = ctx.userRole === "JOB_SEEKER"
      const isEmployer = ctx.userRole === "EMPLOYER"

      // Determine which side is updating
      if (isSeeker) {
        const seeker = await ctx.db.jobSeeker.findUnique({
          where: { clerkUserId: ctx.userId },
        })
        if (!seeker || seeker.id !== match.seekerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
        }
        if (match.seekerStatus !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot change status from ${match.seekerStatus}`,
          })
        }

        const updated = await ctx.db.match.update({
          where: { id: input.matchId },
          data: { seekerStatus: input.status },
        })

        // Check for mutual accept
        if (input.status === "ACCEPTED" && updated.employerStatus === "ACCEPTED") {
          return toMatchResponse(await populateContactInfo(ctx.db, updated.id, match.seekerId))
        }

        return toMatchResponse(updated)
      } else if (isEmployer && ctx.orgId) {
        const employer = await ctx.db.employer.findUnique({
          where: { clerkOrgId: ctx.orgId },
        })
        if (!employer || employer.id !== match.employerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
        }
        if (match.employerStatus !== "PENDING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot change status from ${match.employerStatus}`,
          })
        }

        const updated = await ctx.db.match.update({
          where: { id: input.matchId },
          data: { employerStatus: input.status },
        })

        // Check for mutual accept
        if (input.status === "ACCEPTED" && updated.seekerStatus === "ACCEPTED") {
          return toMatchResponse(await populateContactInfo(ctx.db, updated.id, match.seekerId))
        }

        return toMatchResponse(updated)
      }

      throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
    }),

  /** Get matching workflow status for a posting */
  getWorkflowStatus: employerProcedure
    .input(z.object({ jobPostingId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }

      const conversations = await ctx.db.agentConversation.findMany({
        where: { jobPostingId: input.jobPostingId },
        select: { status: true },
      })

      const matches = await ctx.db.match.count({
        where: { jobPostingId: input.jobPostingId },
      })

      const inProgress = conversations.filter((c) => c.status === "IN_PROGRESS").length
      const completed = conversations.filter(
        (c) => c.status === "COMPLETED_MATCH" || c.status === "COMPLETED_NO_MATCH",
      ).length

      let status: "NOT_STARTED" | "RUNNING" | "COMPLETED"
      if (conversations.length === 0) {
        status = "NOT_STARTED"
      } else if (inProgress > 0) {
        status = "RUNNING"
      } else {
        status = "COMPLETED"
      }

      return {
        status,
        totalCandidates: conversations.length,
        evaluatedCount: completed,
        matchesCreated: matches,
        error: null,
      }
    }),
})

/** Populate contact info on mutual accept */
async function populateContactInfo(
  db: {
    jobSeeker: {
      findUnique: (args: unknown) => Promise<{ name: string; location: string | null } | null>
    }
    match: { update: (args: unknown) => Promise<unknown> }
  },
  matchId: string,
  seekerId: string,
) {
  const seeker = await db.jobSeeker.findUnique({
    where: { id: seekerId },
    select: { name: true, location: true },
  })

  return db.match.update({
    where: { id: matchId },
    data: {
      seekerContactInfo: seeker ? { name: seeker.name, location: seeker.location } : null,
    },
  })
}
