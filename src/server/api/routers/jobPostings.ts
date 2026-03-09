import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  createTRPCRouter,
  publicProcedure,
  employerProcedure,
  jobPosterProcedure,
} from "@/server/api/trpc"
import { toFullJobPosting, toPublicJobPosting } from "@/server/api/helpers/employer-mapper"
import { canTransition, canActivate } from "@/lib/job-posting-status"
import { logActivity } from "@/lib/activity-log"
import { checkPostingLimit } from "@/lib/plan-limits"

const createPostingSchema = z
  .object({
    title: z.string().min(1).max(255),
    department: z.string().max(100).optional(),
    description: z.string().min(1).max(10000),
    responsibilities: z.string().max(5000).optional(),
    requiredSkills: z.array(z.string().max(100)).max(30).default([]),
    preferredSkills: z.array(z.string().max(100)).max(30).optional(),
    experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "EXECUTIVE"]),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]),
    locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
    locationReq: z.string().max(255).optional(),
    salaryMin: z.number().int().min(0).optional(),
    salaryMax: z.number().int().min(0).optional(),
    benefits: z.array(z.string().max(255)).max(20).optional(),
    whyApply: z.string().max(5000).optional(),
  })
  .refine(
    (d) => !(d.salaryMin !== undefined && d.salaryMax !== undefined && d.salaryMax < d.salaryMin),
    {
      message: "Maximum salary must be greater than or equal to minimum",
      path: ["salaryMax"],
    },
  )

const updatePostingSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(255).optional(),
    department: z.string().max(100).optional(),
    description: z.string().min(1).max(10000).optional(),
    responsibilities: z.string().max(5000).optional(),
    requiredSkills: z.array(z.string().max(100)).max(30).optional(),
    preferredSkills: z.array(z.string().max(100)).max(30).optional(),
    experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "EXECUTIVE"]).optional(),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).optional(),
    locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
    locationReq: z.string().max(255).optional(),
    salaryMin: z.number().int().min(0).optional(),
    salaryMax: z.number().int().min(0).optional(),
    benefits: z.array(z.string().max(255)).max(20).optional(),
    whyApply: z.string().max(5000).optional(),
  })
  .refine(
    (d) => !(d.salaryMin !== undefined && d.salaryMax !== undefined && d.salaryMax < d.salaryMin),
    {
      message: "Maximum salary must be greater than or equal to minimum",
      path: ["salaryMax"],
    },
  )

const listSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "EXECUTIVE"]).optional(),
    locationType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  })
  .default({ limit: 20 })

const listMineSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "FILLED"]).optional(),
  })
  .default({ limit: 20 })

export const jobPostingsRouter = createTRPCRouter({
  listMine: employerProcedure.input(listMineSchema).query(async ({ ctx, input }) => {
    const { cursor, limit = 20, status } = input ?? {}
    const where = {
      employerId: ctx.employer.id,
      ...(status ? { status } : {}),
    }
    const items = await ctx.db.jobPosting.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    return {
      items: resultItems.map(toFullJobPosting),
      nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
      hasMore,
    }
  }),

  list: publicProcedure.input(listSchema).query(async ({ ctx, input }) => {
    const { cursor, limit = 20, experienceLevel, locationType } = input ?? {}
    const where = {
      status: "ACTIVE" as const,
      ...(experienceLevel ? { experienceLevel } : {}),
      ...(locationType ? { locationType } : {}),
    }
    const items = await ctx.db.jobPosting.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    return {
      items: resultItems.map(toPublicJobPosting),
      nextCursor: hasMore ? resultItems[resultItems.length - 1]!.id : null,
      hasMore,
    }
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const posting = await ctx.db.jobPosting.findUnique({
        where: { id: input.id },
      })
      if (!posting) return null

      // If caller is the owning employer, return full posting
      let isOwner = false
      if (ctx.orgId) {
        const employer = await ctx.db.employer.findUnique({ where: { clerkOrgId: ctx.orgId } })
        isOwner = employer?.id === posting.employerId
      }
      if (isOwner) return toFullJobPosting(posting)

      // Public access: only active postings
      if (posting.status !== "ACTIVE") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }
      return toPublicJobPosting(posting)
    }),

  create: jobPosterProcedure.input(createPostingSchema).mutation(async ({ ctx, input }) => {
    // Check posting limit (no-op when SUBSCRIPTION_BILLING flag is OFF)
    const limitCheck = await checkPostingLimit(ctx.db as never, ctx.userId)
    if (!limitCheck.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: limitCheck.message ?? "Posting limit reached. Upgrade your plan.",
      })
    }

    const posting = await ctx.db.$transaction(async (tx) => {
      const created = await tx.jobPosting.create({
        data: {
          ...input,
          employerId: ctx.employer.id,
        },
      })
      await tx.jobSettings.create({
        data: { jobPostingId: created.id },
      })
      return created
    })
    await logActivity({
      employerId: ctx.employer.id,
      actorClerkUserId: ctx.userId,
      actorName: ctx.member.clerkUserId,
      action: "posting.created",
      targetType: "JobPosting",
      targetId: posting.id,
      targetLabel: posting.title,
    })
    return toFullJobPosting(posting)
  }),

  update: jobPosterProcedure.input(updatePostingSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    const existing = await ctx.db.jobPosting.findUnique({ where: { id } })
    if (!existing || existing.employerId !== ctx.employer.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
    }
    const updated = await ctx.db.jobPosting.update({
      where: { id },
      data,
    })
    await logActivity({
      employerId: ctx.employer.id,
      actorClerkUserId: ctx.userId,
      actorName: ctx.member.clerkUserId,
      action: "posting.updated",
      targetType: "JobPosting",
      targetId: updated.id,
      targetLabel: updated.title,
    })
    return toFullJobPosting(updated)
  }),

  updateStatus: jobPosterProcedure
    .input(
      z.object({ id: z.string().min(1), status: z.enum(["ACTIVE", "PAUSED", "CLOSED", "FILLED"]) }),
    )
    .mutation(async ({ ctx, input }) => {
      const posting = await ctx.db.jobPosting.findUnique({ where: { id: input.id } })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }
      if (!canTransition(posting.status, input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${posting.status} to ${input.status}`,
        })
      }
      if (input.status === "ACTIVE" && !canActivate(posting)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Title, description, and at least one required skill are needed to activate this posting",
        })
      }
      const previousStatus = posting.status
      const updated = await ctx.db.jobPosting.update({
        where: { id: input.id },
        data: { status: input.status },
      })

      // Fire matching workflow on DRAFT → ACTIVE transition only
      if (previousStatus === "DRAFT" && input.status === "ACTIVE") {
        await ctx.inngest.send({
          name: "matching/posting.activated",
          data: { jobPostingId: input.id, employerId: ctx.employer.id },
        })
      }

      await logActivity({
        employerId: ctx.employer.id,
        actorClerkUserId: ctx.userId,
        actorName: ctx.member.clerkUserId,
        action: "posting.status_changed",
        targetType: "JobPosting",
        targetId: updated.id,
        targetLabel: `${previousStatus} → ${input.status}`,
      })

      return toFullJobPosting(updated)
    }),

  delete: jobPosterProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const posting = await ctx.db.jobPosting.findUnique({ where: { id: input.id } })
      if (!posting || posting.employerId !== ctx.employer.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
      }
      if (posting.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft postings can be deleted",
        })
      }
      await ctx.db.jobPosting.delete({ where: { id: input.id } })
      await logActivity({
        employerId: ctx.employer.id,
        actorClerkUserId: ctx.userId,
        actorName: ctx.member.clerkUserId,
        action: "posting.deleted",
        targetType: "JobPosting",
        targetId: input.id,
        targetLabel: posting.title,
      })
      return { success: true }
    }),
})
