import { db } from "@/lib/db"

interface LogActivityParams {
  employerId: string
  actorClerkUserId: string
  actorName: string
  action: string
  targetType?: string
  targetId?: string
  targetLabel?: string
}

/**
 * Fire-and-forget activity logger for employer team actions.
 * Swallows errors — activity logs are informational, not critical.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        employerId: params.employerId,
        actorClerkUserId: params.actorClerkUserId,
        actorName: params.actorName,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetLabel: params.targetLabel,
      },
    })
  } catch {
    // Fire-and-forget: activity logs are non-critical
  }
}
