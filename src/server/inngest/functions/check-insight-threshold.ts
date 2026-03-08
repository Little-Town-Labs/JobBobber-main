/**
 * Inngest function: check-insight-threshold
 *
 * Lightweight function triggered when a conversation completes.
 * Checks if enough new conversations have occurred since last
 * insight generation to warrant regeneration.
 */
import { inngest } from "@/lib/inngest"
import { db } from "@/lib/db"
import {
  INSIGHT_GENERATION_THRESHOLD,
  INSIGHT_REGENERATION_DELTA,
} from "@/server/insights/insight-schemas"

interface ThresholdEvent {
  data: {
    userId: string
    userType: "JOB_SEEKER" | "EMPLOYER"
  }
}

interface StepTools {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  sendEvent: (name: string, event: unknown) => Promise<void>
}

export function buildThresholdWorkflow() {
  return async ({ event, step }: { event: ThresholdEvent; step: StepTools }) => {
    const { userId, userType } = event.data

    const counts = await step.run("check-counts", async () => {
      const existing = await db.feedbackInsights.findUnique({
        where: { userId_userType: { userId, userType } },
        select: { lastInsightConversationCount: true },
      })

      const lastCount = existing?.lastInsightConversationCount ?? 0

      // Count completed conversations for this user
      const whereClause =
        userType === "JOB_SEEKER"
          ? {
              seekerId: userId,
              status: { in: ["COMPLETED_MATCH", "COMPLETED_NO_MATCH", "TERMINATED"] },
            }
          : {
              jobPosting: { employerId: userId },
              status: { in: ["COMPLETED_MATCH", "COMPLETED_NO_MATCH", "TERMINATED"] },
            }

      const currentCount = await db.agentConversation.count({
        where: whereClause as never,
      })

      return { lastCount, currentCount }
    })

    const delta = counts.currentCount - counts.lastCount
    const isFirstTime = counts.lastCount === 0
    const shouldGenerate = isFirstTime
      ? counts.currentCount >= INSIGHT_GENERATION_THRESHOLD
      : delta >= INSIGHT_REGENERATION_DELTA

    if (shouldGenerate) {
      await step.sendEvent("dispatch-generate", {
        name: "insights/generate",
        data: { userId, userType },
      })
      return { dispatched: true }
    }

    return { dispatched: false }
  }
}

export const checkInsightThreshold = inngest.createFunction(
  { id: "check-insight-threshold", retries: 2 },
  { event: "insights/conversation.completed" },
  buildThresholdWorkflow(),
)
