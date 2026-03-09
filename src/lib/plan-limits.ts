import { getPlanForUser } from "@/lib/billing-plans"
import { SUBSCRIPTION_BILLING } from "@/lib/flags"
import type { PrismaClient } from "@prisma/client"

export interface LimitCheck {
  allowed: boolean
  currentUsage: number
  limit: number | null
  upgradeRequired: boolean
  message: string | null
}

/**
 * Get the active subscription plan ID for a user, or null if on free tier.
 */
async function getActivePlanId(db: PrismaClient, userId: string): Promise<string | null> {
  const subscription = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
    orderBy: { createdAt: "desc" },
    select: { planId: true },
  })
  return subscription?.planId ?? null
}

/**
 * Check if a user can create another conversation this month.
 */
export async function checkConversationLimit(
  db: PrismaClient,
  userId: string,
  userType: "JOB_SEEKER" | "EMPLOYER",
): Promise<LimitCheck> {
  // Bypass all limits when billing flag is OFF
  const billingEnabled = await SUBSCRIPTION_BILLING()
  if (!billingEnabled) {
    return { allowed: true, currentUsage: 0, limit: null, upgradeRequired: false, message: null }
  }

  const planId = await getActivePlanId(db, userId)
  const plan = getPlanForUser(userType, planId)
  const maxConversations = plan.limits.maxConversationsPerMonth

  // Unlimited
  if (maxConversations === null) {
    const currentUsage = await db.agentConversation.count({
      where: buildConversationWhere(userId, userType),
    })
    return { allowed: true, currentUsage, limit: null, upgradeRequired: false, message: null }
  }

  const currentUsage = await db.agentConversation.count({
    where: buildConversationWhere(userId, userType),
  })

  if (currentUsage >= maxConversations) {
    return {
      allowed: false,
      currentUsage,
      limit: maxConversations,
      upgradeRequired: true,
      message: `You've reached your limit of ${maxConversations} conversations this month. Upgrade to continue.`,
    }
  }

  return {
    allowed: true,
    currentUsage,
    limit: maxConversations,
    upgradeRequired: false,
    message: null,
  }
}

/**
 * Check if an employer can create another active posting.
 */
export async function checkPostingLimit(db: PrismaClient, userId: string): Promise<LimitCheck> {
  const billingEnabled = await SUBSCRIPTION_BILLING()
  if (!billingEnabled) {
    return { allowed: true, currentUsage: 0, limit: null, upgradeRequired: false, message: null }
  }

  const planId = await getActivePlanId(db, userId)
  const plan = getPlanForUser("EMPLOYER", planId)
  const maxPostings = plan.limits.maxActivePostings

  if (maxPostings === null) {
    const currentUsage = await db.jobPosting.count({
      where: { employer: { clerkOrgId: userId }, status: "ACTIVE" },
    })
    return { allowed: true, currentUsage, limit: null, upgradeRequired: false, message: null }
  }

  const currentUsage = await db.jobPosting.count({
    where: { employer: { clerkOrgId: userId }, status: "ACTIVE" },
  })

  if (currentUsage >= maxPostings) {
    return {
      allowed: false,
      currentUsage,
      limit: maxPostings,
      upgradeRequired: true,
      message: `You've reached your limit of ${maxPostings} active posting${maxPostings === 1 ? "" : "s"}. Upgrade to post more jobs.`,
    }
  }

  return { allowed: true, currentUsage, limit: maxPostings, upgradeRequired: false, message: null }
}

/**
 * Build the where clause for counting conversations this month.
 */
function buildConversationWhere(userId: string, userType: "JOB_SEEKER" | "EMPLOYER") {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  if (userType === "JOB_SEEKER") {
    return {
      seeker: { clerkUserId: userId },
      startedAt: { gte: monthStart },
    }
  }
  return {
    jobPosting: { employer: { clerkOrgId: userId } },
    startedAt: { gte: monthStart },
  }
}
