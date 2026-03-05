import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, publicProcedure, employerProcedure } from "@/server/api/trpc"
import { toFullJobPosting, toPublicJobPosting } from "@/server/api/helpers/employer-mapper"
import { canTransition, canActivate } from "@/lib/job-posting-status"

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
  .default({})

const listMineSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "FILLED"]).optional(),
  })
  .default({})

export const jobPostingsRouter = createTRPCRouter({
  listMine: employerProcedure.input(listMineSchema).query(async ({ ctx, input }) => {
    const { cursor, limit, status } = input
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
    const { cursor, limit, experienceLevel, locationType } = input
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

  create: employerProcedure.input(createPostingSchema).mutation(async ({ ctx, input }) => {
    const posting = await ctx.db.$transaction(async (tx: typeof ctx.db) => {
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
    return toFullJobPosting(posting)
  }),

  update: employerProcedure.input(updatePostingSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    const existing = await ctx.db.jobPosting.findUnique({ where: { id } })
    if (!existing || existing.employerId !== ctx.employer.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found" })
    }
    const updated = await ctx.db.jobPosting.update({
      where: { id },
      data,
    })
    return toFullJobPosting(updated)
  }),

  updateStatus: employerProcedure
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
      const updated = await ctx.db.jobPosting.update({
        where: { id: input.id },
        data: { status: input.status },
      })
      return toFullJobPosting(updated)
    }),

  delete: employerProcedure
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
      return { success: true }
    }),
})
