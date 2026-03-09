/**
 * Inngest function: generate-feedback-insights
 *
 * Orchestrates the full insight generation pipeline:
 * 1. Aggregate conversation statistics
 * 2. Resolve BYOK key
 * 3. Call LLM (if key available and above threshold)
 * 4. Upsert FeedbackInsights record
 */
import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import {
  buildSeekerInsightContext,
  buildEmployerInsightContext,
} from "@/server/insights/aggregate-stats"
import { generateFeedbackInsights } from "@/server/insights/generate-insights"
import { INSIGHT_GENERATION_THRESHOLD } from "@/server/insights/insight-schemas"
import type { TrendDirection } from "@prisma/client"

interface GenerateEvent {
  data: {
    userId: string
    userType: "JOB_SEEKER" | "EMPLOYER"
  }
}

export function buildGenerateWorkflow() {
  return async ({ event, step }: { event: GenerateEvent; step: StepTools }) => {
    const { userId, userType } = event.data

    // Step 1: Build aggregated context
    const context = await step.run("aggregate-stats", async () => {
      if (userType === "JOB_SEEKER") {
        return buildSeekerInsightContext(userId)
      }
      return buildEmployerInsightContext(userId)
    })

    // Step 2: Check threshold
    const completedCount =
      context.completedMatchCount + context.completedNoMatchCount + context.terminatedCount
    if (completedCount < INSIGHT_GENERATION_THRESHOLD) {
      return { status: "BELOW_THRESHOLD" as const, completedCount }
    }

    // Step 3: Resolve BYOK key
    const byokInfo = await step.run("resolve-byok", async () => {
      if (userType === "JOB_SEEKER") {
        const settings = await db.seekerSettings.findUnique({
          where: { seekerId: userId },
          select: { byokApiKeyEncrypted: true, byokProvider: true },
        })
        if (!settings?.byokApiKeyEncrypted || !settings.byokProvider) {
          return { apiKey: null, provider: null }
        }
        const apiKey = await decrypt(settings.byokApiKeyEncrypted, userId)
        return { apiKey, provider: settings.byokProvider }
      }

      const employer = await db.employer.findUnique({
        where: { id: userId },
        select: { byokApiKeyEncrypted: true, byokProvider: true },
      })
      if (!employer?.byokApiKeyEncrypted || !employer.byokProvider) {
        return { apiKey: null, provider: null }
      }
      const apiKey = await decrypt(employer.byokApiKeyEncrypted, userId)
      return { apiKey, provider: employer.byokProvider }
    })

    // Step 4: Generate insights (or metrics-only)
    if (!byokInfo.apiKey) {
      // Metrics-only: store aggregated stats without AI-generated text
      const trend = computeTrend(context.recentMatchRate, context.overallMatchRate)
      await step.run("upsert-metrics-only", async () => {
        await db.feedbackInsights.upsert({
          where: { userId_userType: { userId, userType } },
          create: {
            userId,
            userType,
            totalConversations: context.totalConversations,
            inProgressCount: context.inProgressCount,
            matchRate: context.matchRate,
            interviewConversionRate: context.acceptanceRate,
            trendDirection: trend,
            lastInsightConversationCount: completedCount,
            strengths: [],
            weaknesses: [],
            recommendations: [],
          },
          update: {
            totalConversations: context.totalConversations,
            inProgressCount: context.inProgressCount,
            matchRate: context.matchRate,
            interviewConversionRate: context.acceptanceRate,
            trendDirection: trend,
            lastInsightConversationCount: completedCount,
          },
        })
      })
      return { status: "METRICS_ONLY" as const }
    }

    const insights = await step.run("generate-insights", async () => {
      return generateFeedbackInsights(context, byokInfo.apiKey, byokInfo.provider)
    })

    // Step 5: Upsert result
    const trend = computeTrend(context.recentMatchRate, context.overallMatchRate)
    await step.run("upsert-insights", async () => {
      await db.feedbackInsights.upsert({
        where: { userId_userType: { userId, userType } },
        create: {
          userId,
          userType,
          strengths: insights?.strengths ?? [],
          weaknesses: insights?.weaknesses ?? [],
          recommendations: insights?.recommendations ?? [],
          totalConversations: context.totalConversations,
          inProgressCount: context.inProgressCount,
          matchRate: context.matchRate,
          interviewConversionRate: context.acceptanceRate,
          trendDirection: trend,
          lastInsightConversationCount: completedCount,
        },
        update: {
          strengths: insights?.strengths ?? [],
          weaknesses: insights?.weaknesses ?? [],
          recommendations: insights?.recommendations ?? [],
          totalConversations: context.totalConversations,
          inProgressCount: context.inProgressCount,
          matchRate: context.matchRate,
          interviewConversionRate: context.acceptanceRate,
          trendDirection: trend,
          lastInsightConversationCount: completedCount,
        },
      })
    })

    return { status: "GENERATED" as const }
  }
}

function computeTrend(recentRate: number, overallRate: number): TrendDirection {
  const delta = recentRate - overallRate
  if (delta > 0.1) return "IMPROVING"
  if (delta < -0.1) return "DECLINING"
  return "STABLE"
}

// Inngest step tools type (simplified for this module)
interface StepTools {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  sendEvent: (name: string, event: unknown) => Promise<void>
}

export const generateFeedbackInsightsFunction = inngest.createFunction(
  { id: "generate-feedback-insights", retries: 3 },
  { event: "insights/generate" },
  buildGenerateWorkflow(),
)
