import "server-only"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { getPlanById } from "@/lib/billing-plans"
import type { PrismaClient } from "@prisma/client"

interface CheckoutParams {
  userId: string
  userType: "JOB_SEEKER" | "EMPLOYER"
  planId: string
  orgId?: string
  couponCode?: string
  db: PrismaClient
}

/**
 * Create a Stripe Checkout session for plan subscription.
 * Creates a Stripe Customer if the user doesn't have one yet.
 */
export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<{ checkoutUrl: string }> {
  const { userId, userType, planId, orgId, couponCode, db } = params

  const plan = getPlanById(planId)
  if (!plan) {
    throw new Error("Invalid plan")
  }
  if (plan.stripePriceId === null) {
    throw new Error("Cannot checkout free plan")
  }

  // Get or create Stripe customer
  let customerId: string

  if (userType === "JOB_SEEKER") {
    const seeker = await db.jobSeeker.findUnique({
      where: { clerkUserId: userId },
    })
    if (!seeker) throw new Error("Seeker profile not found")

    if (seeker.stripeCustomerId) {
      customerId = seeker.stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        metadata: {
          userId,
          userType: "JOB_SEEKER",
          seekerId: seeker.id,
        },
      })
      customerId = customer.id
      await db.jobSeeker.update({
        where: { clerkUserId: userId },
        data: { stripeCustomerId: customerId },
      })
    }
  } else {
    if (!orgId) throw new Error("orgId required for employer checkout")
    const employer = await db.employer.findUnique({
      where: { clerkOrgId: orgId },
    })
    if (!employer) throw new Error("Employer profile not found")

    if (employer.stripeCustomerId) {
      customerId = employer.stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        metadata: {
          userId,
          userType: "EMPLOYER",
          employerId: employer.id,
          orgId,
        },
      })
      customerId = customer.id
      await db.employer.update({
        where: { clerkOrgId: orgId },
        data: { stripeCustomerId: customerId },
      })
    }
  }

  // Create checkout session
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${process.env["NEXT_PUBLIC_APP_URL"] ?? ""}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env["NEXT_PUBLIC_APP_URL"] ?? ""}/billing/cancel`,
    subscription_data: {
      metadata: {
        userId,
        userType,
        planId,
      },
    },
    ...(couponCode ? { discounts: [{ coupon: couponCode }] } : {}),
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  return { checkoutUrl: session.url! }
}

/**
 * Create a Stripe Customer Portal session for subscription management.
 */
export async function createPortalSession(customerId: string): Promise<{ portalUrl: string }> {
  if (!customerId) {
    throw new Error("Stripe customer ID required")
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env["NEXT_PUBLIC_APP_URL"] ?? ""}/settings/billing`,
  })

  return { portalUrl: session.url }
}
