import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { type Prisma, type PrismaClient } from "@prisma/client"
import {
  createTRPCRouter,
  seekerProcedure,
  employerProcedure,
  jobPosterProcedure,
  adminProcedure,
} from "@/server/api/trpc"
import { assertFlagEnabled, PRIVATE_PARAMS, CONVERSATION_LOGS } from "@/lib/flags"

/**
 * Settings router — private negotiation parameters for seekers and employers.
 *
 * PRIVACY INVARIANT: SeekerSettings and JobSettings are NEVER exposed
 * to the other party. These procedures are accessible only by the record owner.
 *
 * NOTE: getSeekerSettings has NO id input — identity comes from ctx.seeker.id.
 */

/** Bounded string array: max items, max chars per item */
const boundedStringArray = (maxItems: number, maxChars: number) =>
  z.array(z.string().max(maxChars)).max(maxItems)

/** Fields to select from SeekerSettings (excludes BYOK and internal fields) */
const seekerSettingsSelect = {
  id: true,
  minSalary: true,
  salaryRules: true,
  dealBreakers: true,
  priorities: true,
  exclusions: true,
  customPrompt: true,
} as const

/** Fields to select from JobSettings (excludes BYOK and internal fields) */
const jobSettingsSelect = {
  id: true,
  trueMaxSalary: true,
  minQualOverride: true,
  willingToTrain: true,
  urgency: true,
  priorityAttrs: true,
  customPrompt: true,
} as const

export const settingsRouter = createTRPCRouter({
  /** Get the seeker's private settings. No id param — uses ctx.seeker identity. */
  getSeekerSettings: seekerProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(PRIVATE_PARAMS)

    const settings = await ctx.db.seekerSettings.findUnique({
      where: { seekerId: ctx.seeker.id },
      select: seekerSettingsSelect,
    })

    return settings ?? null
  }),

  /** Update the seeker's private settings (upsert). */
  updateSeekerSettings: seekerProcedure
    .input(
      z.object({
        minSalary: z.number().int().min(0).optional(),
        salaryRules: z.record(z.string(), z.unknown()).optional(),
        dealBreakers: boundedStringArray(20, 200).optional(),
        priorities: boundedStringArray(20, 200).optional(),
        exclusions: boundedStringArray(20, 200).optional(),
        customPrompt: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(PRIVATE_PARAMS)

      const data = {
        ...input,
        salaryRules: input.salaryRules as Prisma.InputJsonValue | undefined,
      }
      const result = await ctx.db.seekerSettings.upsert({
        where: { seekerId: ctx.seeker.id },
        create: { seekerId: ctx.seeker.id, ...data } as Prisma.SeekerSettingsUncheckedCreateInput,
        update: data as Prisma.SeekerSettingsUncheckedUpdateInput,
        select: seekerSettingsSelect,
      })

      return result
    }),

  /** Get private settings for a specific job posting. */
  getJobSettings: employerProcedure
    .input(z.object({ jobPostingId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(PRIVATE_PARAMS)

      await assertPostingOwnership(ctx, input.jobPostingId)

      const settings = await ctx.db.jobSettings.findUnique({
        where: { jobPostingId: input.jobPostingId },
        select: jobSettingsSelect,
      })

      return settings ?? null
    }),

  /** Update private settings for a job posting (upsert). */
  updateJobSettings: jobPosterProcedure
    .input(
      z.object({
        jobPostingId: z.string().cuid(),
        trueMaxSalary: z.number().int().min(0).optional(),
        minQualOverride: z.record(z.string(), z.unknown()).optional(),
        willingToTrain: boundedStringArray(20, 200).optional(),
        urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        priorityAttrs: boundedStringArray(10, 200).optional(),
        customPrompt: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(PRIVATE_PARAMS)

      await assertPostingOwnership(ctx, input.jobPostingId)

      const { jobPostingId, ...rawData } = input
      const jobData = {
        ...rawData,
        minQualOverride: rawData.minQualOverride as Prisma.InputJsonValue | undefined,
      }
      const result = await ctx.db.jobSettings.upsert({
        where: { jobPostingId },
        create: { jobPostingId, ...jobData } as Prisma.JobSettingsUncheckedCreateInput,
        update: jobData as Prisma.JobSettingsUncheckedUpdateInput,
        select: jobSettingsSelect,
      })

      return result
    }),

  /** Get data usage opt-out preference for seeker */
  getSeekerDataUsageOptOut: seekerProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(CONVERSATION_LOGS)

    const settings = await ctx.db.seekerSettings.findUnique({
      where: { seekerId: ctx.seeker.id },
      select: { dataUsageOptOut: true },
    })

    return { optOut: settings?.dataUsageOptOut ?? false }
  }),

  /** Update data usage opt-out preference for seeker */
  updateSeekerDataUsageOptOut: seekerProcedure
    .input(z.object({ optOut: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(CONVERSATION_LOGS)

      await ctx.db.seekerSettings.upsert({
        where: { seekerId: ctx.seeker.id },
        create: { seekerId: ctx.seeker.id, dataUsageOptOut: input.optOut },
        update: { dataUsageOptOut: input.optOut },
      })

      return { optOut: input.optOut }
    }),

  /** Get data usage opt-out preference for employer */
  getEmployerDataUsageOptOut: employerProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(CONVERSATION_LOGS)

    return { optOut: ctx.employer.dataUsageOptOut }
  }),

  /** Update data usage opt-out preference for employer */
  updateEmployerDataUsageOptOut: adminProcedure
    .input(z.object({ optOut: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(CONVERSATION_LOGS)

      await ctx.db.employer.update({
        where: { id: ctx.employer.id },
        data: { dataUsageOptOut: input.optOut },
      })

      return { optOut: input.optOut }
    }),
})

/** Verify that the job posting belongs to the authenticated employer. */
async function assertPostingOwnership(
  ctx: {
    db: PrismaClient
    employer: { id: string }
  },
  jobPostingId: string,
): Promise<void> {
  const posting = await ctx.db.jobPosting.findUnique({
    where: { id: jobPostingId },
    select: { employerId: true },
  })

  if (!posting || posting.employerId !== ctx.employer.id) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Job posting not found.",
    })
  }
}
