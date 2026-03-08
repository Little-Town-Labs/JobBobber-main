/**
 * Insights router — AI-generated feedback aggregates.
 *
 * Gated behind the FEEDBACK_INSIGHTS feature flag.
 * Never exposes raw conversation data — computed aggregates only.
 *
 * @see .specify/specs/14-aggregate-feedback-insights/spec.md
 */
import {
  createTRPCRouter,
  seekerProcedure,
  employerProcedure,
  protectedProcedure,
} from "@/server/api/trpc"
import { assertFlagEnabled, FEEDBACK_INSIGHTS } from "@/lib/flags"
import {
  INSIGHT_GENERATION_THRESHOLD,
  INSIGHT_REFRESH_RATE_LIMIT_MS,
} from "@/server/insights/insight-schemas"

/** Shape returned to the client */
interface InsightsResponse {
  id: string | null
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  metrics: {
    totalConversations: number
    inProgressCount: number
    matchRate: number
    interviewConversionRate: number
  }
  trendDirection: string
  generatedAt: Date | null
  belowThreshold: boolean
  thresholdProgress: { current: number; required: number }
}

function toResponse(
  record: {
    id: string
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
    totalConversations: number
    inProgressCount: number
    matchRate: number
    interviewConversionRate: number
    trendDirection: string
    generatedAt: Date
  } | null,
  completedCount: number,
): InsightsResponse {
  const belowThreshold = completedCount < INSIGHT_GENERATION_THRESHOLD

  if (!record) {
    return {
      id: null,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      metrics: {
        totalConversations: completedCount,
        inProgressCount: 0,
        matchRate: 0,
        interviewConversionRate: 0,
      },
      trendDirection: "STABLE",
      generatedAt: null,
      belowThreshold,
      thresholdProgress: {
        current: completedCount,
        required: INSIGHT_GENERATION_THRESHOLD,
      },
    }
  }

  return {
    id: record.id,
    strengths: record.strengths,
    weaknesses: record.weaknesses,
    recommendations: record.recommendations,
    metrics: {
      totalConversations: record.totalConversations,
      inProgressCount: record.inProgressCount,
      matchRate: record.matchRate,
      interviewConversionRate: record.interviewConversionRate,
    },
    trendDirection: record.trendDirection,
    generatedAt: record.generatedAt,
    belowThreshold,
    thresholdProgress: {
      current: completedCount,
      required: INSIGHT_GENERATION_THRESHOLD,
    },
  }
}

export const insightsRouter = createTRPCRouter({
  /** Get the seeker's aggregate feedback insights */
  getSeekerInsights: seekerProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(FEEDBACK_INSIGHTS)

    const [record, completedCount] = await Promise.all([
      ctx.db.feedbackInsights.findUnique({
        where: { userId_userType: { userId: ctx.seeker.id, userType: "JOB_SEEKER" } },
      }),
      ctx.db.agentConversation.count({
        where: {
          seekerId: ctx.seeker.id,
          status: { in: ["COMPLETED_MATCH", "COMPLETED_NO_MATCH", "TERMINATED"] },
        },
      }),
    ])

    return toResponse(record, completedCount)
  }),

  /** Get the employer's aggregate feedback insights */
  getEmployerInsights: employerProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(FEEDBACK_INSIGHTS)

    const [record, completedCount] = await Promise.all([
      ctx.db.feedbackInsights.findUnique({
        where: { userId_userType: { userId: ctx.employer.id, userType: "EMPLOYER" } },
      }),
      ctx.db.agentConversation.count({
        where: {
          jobPosting: { employerId: ctx.employer.id },
          status: { in: ["COMPLETED_MATCH", "COMPLETED_NO_MATCH", "TERMINATED"] },
        },
      }),
    ])

    return toResponse(record, completedCount)
  }),

  /** Manually trigger insight regeneration (rate-limited to 1/hour) */
  refreshInsights: protectedProcedure.mutation(async ({ ctx }) => {
    await assertFlagEnabled(FEEDBACK_INSIGHTS)

    const isSeeker = ctx.userRole === "JOB_SEEKER"
    const userId = isSeeker
      ? (
          await ctx.db.jobSeeker.findUnique({
            where: { clerkUserId: ctx.userId },
            select: { id: true },
          })
        )?.id
      : ctx.orgId
        ? (
            await ctx.db.employer.findUnique({
              where: { clerkOrgId: ctx.orgId },
              select: { id: true },
            })
          )?.id
        : null

    if (!userId) {
      return { status: "queued" as const, nextRefreshAvailableAt: null }
    }

    const userType = isSeeker ? "JOB_SEEKER" : "EMPLOYER"

    // Check rate limit
    const existing = await ctx.db.feedbackInsights.findUnique({
      where: { userId_userType: { userId, userType } },
      select: { generatedAt: true },
    })

    if (existing) {
      const timeSinceLastGeneration = Date.now() - existing.generatedAt.getTime()
      if (timeSinceLastGeneration < INSIGHT_REFRESH_RATE_LIMIT_MS) {
        const nextAvailable = new Date(
          existing.generatedAt.getTime() + INSIGHT_REFRESH_RATE_LIMIT_MS,
        )
        return {
          status: "rate_limited" as const,
          nextRefreshAvailableAt: nextAvailable,
        }
      }
    }

    await ctx.inngest.send({
      name: "insights/generate",
      data: { userId, userType },
    })

    return { status: "queued" as const, nextRefreshAvailableAt: null }
  }),
})
