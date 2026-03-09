/**
 * Matches router — viewing and acting on AI-generated match recommendations.
 *
 * @see .specify/specs/5-basic-ai-matching/spec.md
 */
import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import {
  createTRPCRouter,
  protectedProcedure,
  seekerProcedure,
  employerProcedure,
} from "@/server/api/trpc"
import { toMatchResponse } from "@/server/api/helpers/match-mapper"
import { ADVANCED_EMPLOYER_DASHBOARD, assertFlagEnabled } from "@/lib/flags"
import { logActivity } from "@/lib/activity-log"
import { logAudit } from "@/lib/audit"

export const matchesRouter = createTRPCRouter({
  /** List matches for a specific job posting (employer view) */
  listForPosting: employerProcedure
    .input(
      z.object({
        jobPostingId: z.string().min(1),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        status: z.enum(["PENDING", "ACCEPTED", "DECLINED"]).optional(),
        sort: z.enum(["confidence", "newest"]).optional(),
        // Advanced filters (Feature 17)
        confidenceLevel: z.array(z.enum(["STRONG", "GOOD", "POTENTIAL"])).optional(),
        experienceLevel: z.array(z.enum(["ENTRY", "MID", "SENIOR", "EXECUTIVE"])).optional(),
        locationType: z.array(z.enum(["REMOTE", "HYBRID", "ONSITE"])).optional(),
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

      const where: Record<string, unknown> = { jobPostingId: input.jobPostingId }
      if (input.status) where.employerStatus = input.status
      if (input.confidenceLevel?.length) where.confidenceScore = { in: input.confidenceLevel }

      const orderBy =
        input.sort === "newest"
          ? { createdAt: "desc" as const }
          : { confidenceScore: "desc" as const }

      const items = await ctx.db.match.findMany({
        where,
        orderBy,
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
          status: z.enum(["PENDING", "ACCEPTED", "DECLINED"]).optional(),
          sort: z.enum(["confidence", "newest"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit = 20, status, sort } = input ?? {}

      const where: Record<string, unknown> = { seekerId: ctx.seeker.id }
      if (status) where.seekerStatus = status

      const orderBy =
        sort === "newest" ? { createdAt: "desc" as const } : { confidenceScore: "desc" as const }

      const items = await ctx.db.match.findMany({
        where,
        orderBy,
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
      const isSeeker = ctx.userRole === "JOB_SEEKER"
      const isEmployer = ctx.userRole === "EMPLOYER"

      // Parallelize match fetch with ownership lookup
      const [match, owner] = await Promise.all([
        ctx.db.match.findUnique({ where: { id: input.id } }),
        isSeeker
          ? ctx.db.jobSeeker.findUnique({ where: { clerkUserId: ctx.userId } })
          : isEmployer && ctx.orgId
            ? ctx.db.employer.findUnique({ where: { clerkOrgId: ctx.orgId } })
            : Promise.resolve(null),
      ])

      if (!match) return null

      // Ownership check: must be the seeker or the employer
      if (isSeeker) {
        if (!owner || owner.id !== match.seekerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
        }
      } else if (isEmployer && ctx.orgId) {
        if (!owner || owner.id !== match.employerId) {
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

        void logAudit({
          actorId: ctx.userId,
          actorType: "JOB_SEEKER",
          action: `match.${input.status.toLowerCase()}`,
          entityType: "Match",
          entityId: input.matchId,
          result: "SUCCESS",
        })

        // Check for mutual accept
        if (input.status === "ACCEPTED" && updated.employerStatus === "ACCEPTED") {
          const populated = await populateContactInfo(ctx.db, updated.id, match.seekerId)
          await ctx.inngest?.send?.({
            name: "notification/mutual.accept",
            data: {
              matchId: match.id,
              seekerId: match.seekerId,
              employerId: match.employerId,
              jobPostingId: match.jobPostingId,
            },
          })
          return toMatchResponse(populated)
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

        void logAudit({
          actorId: ctx.userId,
          actorType: "EMPLOYER",
          action: `match.${input.status.toLowerCase()}`,
          entityType: "Match",
          entityId: input.matchId,
          result: "SUCCESS",
        })

        // Check for mutual accept
        if (input.status === "ACCEPTED" && updated.seekerStatus === "ACCEPTED") {
          const populated = await populateContactInfo(ctx.db, updated.id, match.seekerId)
          await ctx.inngest?.send?.({
            name: "notification/mutual.accept",
            data: {
              matchId: match.id,
              seekerId: match.seekerId,
              employerId: match.employerId,
              jobPostingId: match.jobPostingId,
            },
          })
          return toMatchResponse(populated)
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

      const [conversations, matches] = await Promise.all([
        ctx.db.agentConversation.findMany({
          where: { jobPostingId: input.jobPostingId },
          select: { status: true },
        }),
        ctx.db.match.count({
          where: { jobPostingId: input.jobPostingId },
        }),
      ])

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

  /** Get match status counts for the authenticated seeker */
  getStatusCounts: seekerProcedure.query(async ({ ctx }) => {
    const where = { seekerId: ctx.seeker.id }
    const [all, groups] = await Promise.all([
      ctx.db.match.count({ where }),
      ctx.db.match.groupBy({ where, by: ["seekerStatus"], _count: { _all: true } }),
    ])

    const counts = { all, pending: 0, accepted: 0, declined: 0 }
    for (const g of groups) {
      const key = g.seekerStatus.toLowerCase() as "pending" | "accepted" | "declined"
      if (key in counts) counts[key] = g._count._all
    }
    return counts
  }),

  /** Get match status counts for a specific job posting (employer view) */
  getPostingStatusCounts: employerProcedure
    .input(z.object({ jobPostingId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }

      const where = { jobPostingId: input.jobPostingId }
      const [all, groups] = await Promise.all([
        ctx.db.match.count({ where }),
        ctx.db.match.groupBy({ where, by: ["employerStatus"], _count: { _all: true } }),
      ])

      const counts = { all, pending: 0, accepted: 0, declined: 0 }
      for (const g of groups) {
        const key = g.employerStatus.toLowerCase() as "pending" | "accepted" | "declined"
        if (key in counts) counts[key] = g._count._all
      }
      return counts
    }),

  /** Compare 2-4 candidates side-by-side (Feature 17) */
  getForComparison: employerProcedure
    .input(
      z.object({
        jobPostingId: z.string().min(1),
        matchIds: z.array(z.string().min(1)).min(2).max(4),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(ADVANCED_EMPLOYER_DASHBOARD)

      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }

      const matches = await ctx.db.match.findMany({
        where: {
          id: { in: input.matchIds },
          jobPostingId: input.jobPostingId,
        },
        include: {
          seeker: {
            select: { name: true, skills: true, location: true, experience: true },
          },
        },
      })

      return matches.map((m) => ({
        matchId: m.id,
        confidenceScore: m.confidenceScore,
        matchSummary: m.matchSummary,
        evaluationData: m.evaluationData,
        seekerName: (m as unknown as { seeker: { name: string } }).seeker?.name ?? "Unknown",
        seekerSkills: (m as unknown as { seeker: { skills: string[] } }).seeker?.skills ?? [],
        seekerExperienceLevel: null as string | null,
        seekerLocation:
          (m as unknown as { seeker: { location: string | null } }).seeker?.location ?? null,
        employerStatus: m.employerStatus,
        createdAt: m.createdAt.toISOString(),
      }))
    }),

  /** Bulk accept or decline multiple matches (Feature 17) */
  bulkUpdateStatus: employerProcedure
    .input(
      z.object({
        jobPostingId: z.string().min(1),
        matchIds: z.array(z.string().min(1)).min(1).max(100),
        status: z.enum(["ACCEPTED", "DECLINED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(ADVANCED_EMPLOYER_DASHBOARD)

      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }

      const total = input.matchIds.length

      // Only update PENDING matches — skip already-decided ones (EC-4)
      const result = await ctx.db.match.updateMany({
        where: {
          id: { in: input.matchIds },
          jobPostingId: input.jobPostingId,
          employerStatus: "PENDING",
        },
        data: { employerStatus: input.status },
      })

      const updated = result.count
      const skipped = total - updated

      void logAudit({
        actorId: ctx.userId,
        actorType: "EMPLOYER",
        action: `match.bulk_${input.status.toLowerCase()}`,
        entityType: "Match",
        entityId: input.jobPostingId,
        metadata: { updated, skipped, total },
        result: "SUCCESS",
      })

      // Fire-and-forget activity log
      logActivity({
        employerId: ctx.employer.id,
        actorClerkUserId: ctx.userId,
        actorName: ctx.member.clerkUserId,
        action: `bulk.${input.status.toLowerCase()}`,
        targetType: "Match",
        targetId: input.jobPostingId,
        targetLabel: `${updated} matches ${input.status.toLowerCase()}d for ${posting.title}`,
      })

      return { updated, skipped, total }
    }),
})

/** Populate contact info on mutual accept */
async function populateContactInfo(db: PrismaClient, matchId: string, seekerId: string) {
  const seeker = await db.jobSeeker.findUnique({
    where: { id: seekerId },
    select: { name: true, location: true },
  })

  return db.match.update({
    where: { id: matchId },
    data: {
      seekerContactInfo: seeker
        ? ({ name: seeker.name, location: seeker.location } as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  })
}
