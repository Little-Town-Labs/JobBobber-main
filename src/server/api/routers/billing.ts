import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc"
import { SUBSCRIPTION_BILLING, assertFlagEnabled } from "@/lib/flags"
import { getPlansForUserType, getPlanForUser, getPlanById } from "@/lib/billing-plans"
import { checkConversationLimit, checkPostingLimit } from "@/lib/plan-limits"
import { createCheckoutSession, createPortalSession } from "@/lib/stripe-sessions"
import { stripe } from "@/lib/stripe"
import { logAudit } from "@/lib/audit"

async function getStripeCustomerId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma client type
  db: any,
  userRole: string | null,
  userId: string,
  orgId: string | null,
): Promise<string | null> {
  if (userRole === "JOB_SEEKER") {
    const seeker = await db.jobSeeker.findUnique({
      where: { clerkUserId: userId },
      select: { stripeCustomerId: true },
    })
    return seeker?.stripeCustomerId ?? null
  }
  if (orgId) {
    const employer = await db.employer.findUnique({
      where: { clerkOrgId: orgId },
      select: { stripeCustomerId: true },
    })
    return employer?.stripeCustomerId ?? null
  }
  return null
}

export const billingRouter = createTRPCRouter({
  /**
   * Get available plans for a user type.
   */
  getPlans: protectedProcedure
    .input(z.object({ userType: z.enum(["JOB_SEEKER", "EMPLOYER"]) }))
    .query(async ({ input }) => {
      await assertFlagEnabled(SUBSCRIPTION_BILLING)
      return getPlansForUserType(input.userType)
    }),

  /**
   * Get current user's active subscription.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(SUBSCRIPTION_BILLING)

    const subscription = await ctx.db.subscription.findFirst({
      where: {
        userId: ctx.userId,
        status: { in: ["ACTIVE", "PAST_DUE", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!subscription) return null

    const plan = getPlanById(subscription.planId)
    return {
      id: subscription.id,
      planId: subscription.planId,
      planName: plan?.name ?? subscription.planId,
      status: subscription.status,
      monthlyPrice: plan?.monthlyPrice ?? 0,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    }
  }),

  /**
   * Get current usage against plan limits.
   */
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(SUBSCRIPTION_BILLING)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const conversationWhere =
      ctx.userRole === "JOB_SEEKER"
        ? { seeker: { clerkUserId: ctx.userId }, startedAt: { gte: monthStart } }
        : { jobPosting: { employer: { clerkOrgId: ctx.orgId! } }, startedAt: { gte: monthStart } }

    // Parallelize all independent queries
    const [subscription, conversationsThisMonth, activePostings] = await Promise.all([
      ctx.db.subscription.findFirst({
        where: { userId: ctx.userId, status: { in: ["ACTIVE", "PAST_DUE"] } },
        orderBy: { createdAt: "desc" },
        select: { planId: true },
      }),
      ctx.db.agentConversation.count({ where: conversationWhere }),
      ctx.userRole === "EMPLOYER" && ctx.orgId
        ? ctx.db.jobPosting.count({
            where: { employer: { clerkOrgId: ctx.orgId }, status: "ACTIVE" },
          })
        : Promise.resolve(0),
    ])

    const plan = getPlanForUser(ctx.userRole!, subscription?.planId ?? null)

    return {
      conversationsThisMonth,
      conversationLimit: plan.limits.maxConversationsPerMonth,
      activePostings,
      postingLimit: plan.limits.maxActivePostings,
    }
  }),

  /**
   * Get payment history from Stripe.
   */
  getPaymentHistory: protectedProcedure.query(async ({ ctx }) => {
    await assertFlagEnabled(SUBSCRIPTION_BILLING)

    const stripeCustomerId = await getStripeCustomerId(
      ctx.db,
      ctx.userRole,
      ctx.userId,
      ctx.orgId ?? null,
    )
    if (!stripeCustomerId) return []

    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 24,
    })

    return invoices.data.map((inv) => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: (inv.amount_paid ?? 0) / 100,
      status: inv.status as "paid" | "open" | "void" | "uncollectible",
      invoiceUrl: inv.hosted_invoice_url ?? null,
    }))
  }),

  /**
   * Create a Stripe Checkout session for plan subscription.
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        couponCode: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertFlagEnabled(SUBSCRIPTION_BILLING)

      const session = await createCheckoutSession({
        userId: ctx.userId,
        userType: ctx.userRole!,
        planId: input.planId,
        orgId: ctx.orgId ?? undefined,
        couponCode: input.couponCode,
        db: ctx.db as never,
      })

      void logAudit({
        actorId: ctx.userId,
        actorType: ctx.userRole === "JOB_SEEKER" ? "JOB_SEEKER" : "EMPLOYER",
        action: "billing.create_checkout",
        entityType: "Subscription",
        metadata: { planId: input.planId },
        result: "SUCCESS",
      })

      return session
    }),

  /**
   * Create a Stripe Customer Portal session.
   */
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    await assertFlagEnabled(SUBSCRIPTION_BILLING)

    const stripeCustomerId = await getStripeCustomerId(
      ctx.db,
      ctx.userRole,
      ctx.userId,
      ctx.orgId ?? null,
    )
    if (!stripeCustomerId) {
      throw new Error("No Stripe customer found. Subscribe to a plan first.")
    }

    void logAudit({
      actorId: ctx.userId,
      actorType: ctx.userRole === "JOB_SEEKER" ? "JOB_SEEKER" : "EMPLOYER",
      action: "billing.access_portal",
      entityType: "Subscription",
      result: "SUCCESS",
    })

    return createPortalSession(stripeCustomerId)
  }),

  /**
   * Check if a specific action is within plan limits.
   */
  checkLimit: protectedProcedure
    .input(z.object({ action: z.enum(["create_conversation", "create_posting"]) }))
    .query(async ({ ctx, input }) => {
      await assertFlagEnabled(SUBSCRIPTION_BILLING)

      if (input.action === "create_conversation") {
        return checkConversationLimit(ctx.db as never, ctx.userId, ctx.userRole!)
      }
      return checkPostingLimit(ctx.db as never, ctx.userId)
    }),
})
