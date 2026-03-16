import "server-only"
import Stripe from "stripe"

/**
 * Server-side Stripe client singleton (lazy-initialized).
 *
 * Environment variables required:
 * - STRIPE_SECRET_KEY: Stripe secret key (sk_test_... or sk_live_...)
 * - STRIPE_WEBHOOK_SECRET: Webhook endpoint signing secret (whsec_...)
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Publishable key for client-side (pk_test_... or pk_live_...)
 */

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env["STRIPE_SECRET_KEY"]
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required")
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    })
  }
  return _stripe
}

/** @deprecated Use getStripe() for lazy initialization */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    // Proxy pattern requires dynamic property access — TypeScript can't type this
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
