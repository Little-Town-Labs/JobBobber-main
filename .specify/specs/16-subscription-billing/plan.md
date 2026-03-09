# Implementation Plan — Feature 16: Subscription Billing

**Branch:** 16-subscription-billing
**Specification:** .specify/specs/16-subscription-billing/spec.md

---

## Executive Summary

Integrate Stripe subscription billing into JobBobber with tiered plans for job seekers (Free/Pro) and employers (Free/Business/Enterprise). The implementation uses Stripe Checkout for PCI-compliant payments, Stripe Customer Portal for payment management, and Inngest for reliable webhook event processing. All billing features are gated behind a `SUBSCRIPTION_BILLING` feature flag that defaults to OFF.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Client (Next.js)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Pricing Page │  │ Billing Dash │  │ Upgrade CTAs  │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                    │          │
│         └────────────────┼────────────────────┘          │
│                          │ tRPC                          │
├──────────────────────────┼──────────────────────────────┤
│                   Server (tRPC)                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              billing.ts router                     │  │
│  │  getPlans | getSubscription | createCheckoutSession│  │
│  │  createPortalSession | getUsage | checkLimit       │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────┼─────────────────────────────┐  │
│  │           Stripe SDK (server-side)                 │  │
│  │  Checkout Sessions | Customer Portal | Invoices    │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────┼─────────────────────────────┐  │
│  │     plan-limits.ts (usage enforcement)             │  │
│  │  checkConversationLimit | checkPostingLimit         │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                   Webhooks & Events                      │
│  ┌────────────────────┐  ┌─────────────────────────────┐│
│  │ /api/webhooks/     │  │ Inngest Functions            ││
│  │   stripe/route.ts  │──│ process-stripe-event         ││
│  │ (verify + dispatch)│  │ (idempotent event handling)  ││
│  └────────────────────┘  └─────────────────────────────┘│
├──────────────────────────────────────────────────────────┤
│                   Database (Prisma)                       │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐           │
│  │Employer  │ │ Subscription │ │StripeEvent │           │
│  │+stripeId │ │ (lifecycle)  │ │(idempotency│           │
│  └──────────┘ └──────────────┘ └────────────┘           │
│  ┌──────────┐                                            │
│  │JobSeeker │                                            │
│  │+stripeId │                                            │
│  └──────────┘                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component        | Choice                           | Rationale                                                  |
| ---------------- | -------------------------------- | ---------------------------------------------------------- |
| Payment Provider | Stripe                           | PRD requirement, industry standard, PCI-compliant Checkout |
| Checkout         | Stripe Checkout (hosted)         | Zero PCI scope, handles 3DS/Apple Pay/Google Pay           |
| Portal           | Stripe Customer Portal           | Secure payment method updates without PCI scope            |
| Webhooks         | Stripe → Next.js route → Inngest | Reliable async processing with retries                     |
| State            | Local DB + webhook sync          | < 50ms status checks per NFR-2                             |
| Feature Flag     | Vercel Flags SDK                 | Consistent with existing pattern (SUBSCRIPTION_BILLING)    |

---

## Technical Decisions

### TD-1: Plan Definitions as Application Constants

**Context:** Where to define plan features, limits, and pricing
**Options:** (A) Database table, (B) Application constants, (C) Stripe metadata
**Chosen:** B — Application constants in `src/lib/billing-plans.ts`
**Rationale:** Plans are few and rarely change. Constants are type-safe, testable, and don't require DB queries. Stripe Price IDs mapped via env vars.
**Tradeoffs:** Changing plans requires a code deploy (acceptable for 5 plans).

### TD-2: Usage Enforcement via Derived Counts

**Context:** How to track free tier usage for limit enforcement
**Options:** (A) Separate usage counter table, (B) Derive from existing data, (C) Redis counters
**Chosen:** B — COUNT queries on AgentConversation and JobPosting tables
**Rationale:** Usage data already exists. Adding a counter table creates sync complexity. COUNT queries on indexed fields are fast enough (< 10ms for typical volumes).
**Tradeoffs:** Slightly slower than pre-computed counters, but simpler and always accurate.

### TD-3: Webhook Processing via Inngest

**Context:** How to process Stripe webhook events reliably
**Options:** (A) Inline in webhook route, (B) Inngest background function, (C) Queue + worker
**Chosen:** B — Inngest background function
**Rationale:** Inngest already used for all async processing. Built-in retries, idempotency via step.run(), and observability. Webhook route stays thin (verify + dispatch).
**Tradeoffs:** Slight delay (seconds) between Stripe event and local state update.

### TD-4: Billing Router Access Control

**Context:** Who can access billing procedures
**Options:** (A) protectedProcedure (any authenticated user), (B) Role-specific procedures
**Chosen:** Mixed — `protectedProcedure` for reads (getPlans, getSubscription), `adminProcedure` for mutations (createCheckoutSession for employers), `seekerProcedure` for seeker checkout
**Rationale:** Any user can view plans. Only employer admins can initiate employer billing changes. Seekers manage their own billing.

---

## Implementation Phases

### Phase 1: Foundation (flag, schema, plans)

- Add `SUBSCRIPTION_BILLING` feature flag (defaults OFF)
- Add `stripe` npm dependency
- Add Stripe env vars to Vercel
- Prisma migration: `stripeCustomerId` on Employer/JobSeeker, Subscription model, StripeEvent model
- Create `src/lib/billing-plans.ts` with plan definitions and limit constants
- Create `src/lib/stripe.ts` with Stripe client initialization

### Phase 2: Stripe Integration (checkout, portal, webhooks)

- Stripe webhook route (`/api/webhooks/stripe/route.ts`) with signature verification
- Inngest function `process-stripe-event` for idempotent webhook handling
- Stripe Checkout session creation (seeker Pro, employer Business)
- Stripe Customer Portal session creation
- Stripe customer creation (on first checkout)

### Phase 3: Billing Router & Usage Enforcement

- tRPC billing router with all procedures (getPlans, getSubscription, getUsage, getPaymentHistory, createCheckoutSession, createPortalSession, checkLimit)
- Plan limit enforcement utility (`src/lib/plan-limits.ts`)
- Integration points: check limits before conversation creation and posting creation
- Register billing router in root

### Phase 4: Billing UI

- Pricing page component (plan comparison, CTAs)
- Billing dashboard page (current plan, usage, payment history)
- Upgrade prompts when limits are hit
- Checkout success/cancel redirect pages
- Nav link additions for billing

### Phase 5: Testing & Polish

- Unit tests for billing router, plan limits, webhook handler
- Integration tests for Stripe event processing flow
- Limit enforcement tests (seeker and employer free tiers)
- Feature flag ON/OFF behavior tests
- Beta coupon flow testing

---

## Security Considerations

- **PCI Compliance:** No card data touches the platform. Stripe Checkout and Portal handle all payment input.
- **Webhook Verification:** `stripe.webhooks.constructEvent()` verifies event signatures using `STRIPE_WEBHOOK_SECRET`. Invalid signatures return HTTP 401.
- **Idempotency:** StripeEvent table deduplicates by `stripeEventId`. Processing the same event twice produces the same result.
- **Authorization:** Checkout and portal session creation require authentication. Employer billing requires `org:admin` role.
- **Secrets:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only env vars, never exposed to client. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is safe for client use.

---

## Performance Strategy

- **Subscription status checks (< 50ms):** Query local `Subscription` table with indexed `userId` field. No Stripe API call on reads.
- **Payment history:** Fetched from Stripe API (cached in tRPC query for the session). Acceptable latency since it's a dashboard view.
- **Limit checks (< 10ms):** COUNT queries on indexed columns (`seekerId`, `employerId`, `createdAt`).
- **Webhook processing (< 30s):** Inngest processes events asynchronously. Webhook route returns 200 immediately after signature verification and dispatch.

---

## Testing Strategy

- **Unit tests:** Plan limit logic, subscription status derivation, webhook event routing
- **Integration tests:** Billing router procedures with mocked Stripe SDK, webhook handler with mocked Stripe verification
- **Edge case tests:** Duplicate webhook events, expired subscriptions, downgrade with excess postings
- **Feature flag tests:** All billing hidden when flag OFF, free tier defaults when flag ON with no subscription
- **Coverage target:** 80%+

---

## Deployment Strategy

1. Deploy Prisma migration (add nullable fields + new tables)
2. Deploy code with `SUBSCRIPTION_BILLING` flag OFF (no user impact)
3. Configure Stripe products, prices, and webhook endpoint in Stripe Dashboard
4. Set env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
5. Test webhook delivery from Stripe CLI in staging
6. Enable `SUBSCRIPTION_BILLING` flag for beta testers
7. Roll out to all users

---

## Risks & Mitigation

| Risk                          | Impact                                      | Mitigation                                                                         |
| ----------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Webhook delivery failure      | Subscription state out of sync              | Inngest retries + Stripe auto-retries. Manual reconciliation endpoint as fallback. |
| Race condition on limit check | User exceeds limit between check and action | Acceptable: soft limits, not financial. Worst case: one extra conversation.        |
| Stripe API downtime           | Checkout and portal unavailable             | Show "temporarily unavailable" message. Local subscription reads still work.       |
| Coupon abuse                  | Revenue loss from beta pricing              | Stripe coupon configuration limits redemptions and expiry.                         |

---

## Constitutional Compliance

- [x] Type Safety First (I) — Zod schemas for all Stripe data, typed plan definitions
- [x] Test-Driven Development (II) — TDD for all billing logic, 80%+ coverage
- [x] BYOK Architecture (III) — Not applicable (Stripe is platform infrastructure, not user-provided)
- [x] Minimal Abstractions (IV) — Direct Stripe SDK usage, no billing framework wrapper
- [x] Security & Privacy (V) — No PCI data stored, webhook signatures verified, RBAC enforced
- [x] Phased Rollout (VI) — SUBSCRIPTION_BILLING flag defaults OFF
- [x] Agent Autonomy (VII) — Not applicable to billing
