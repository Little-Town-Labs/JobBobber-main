# Technology Research — Feature 16: Subscription Billing

## Decision 1: Payment Provider

**Options Considered:**

1. **Stripe** — Industry standard, hosted checkout, customer portal, webhook events
2. **Paddle** — Merchant of record (handles tax/VAT), fewer features
3. **LemonSqueezy** — Developer-friendly, MoR, less mature

**Chosen:** Stripe
**Rationale:** PRD specifies Stripe. Best documentation, widest adoption, Stripe Checkout handles PCI compliance, Customer Portal handles payment method updates. Inngest has native Stripe event support. Existing Clerk integration has Stripe patterns.
**Tradeoffs:** Platform is responsible for tax compliance (not MoR). Stripe Checkout is opinionated but handles PCI.

## Decision 2: Checkout Integration Pattern

**Options Considered:**

1. **Stripe Checkout (hosted)** — Redirect to Stripe-hosted page, zero PCI scope
2. **Stripe Elements (embedded)** — Custom card form, higher PCI scope (SAQ A-EP)
3. **Stripe Payment Links** — No-code, very limited customization

**Chosen:** Stripe Checkout (hosted)
**Rationale:** Zero PCI scope on the platform. Handles 3D Secure, Apple Pay, Google Pay automatically. Supports coupons for beta pricing. Server creates a Checkout Session, client redirects.
**Tradeoffs:** Less UI control than Elements, but security and compliance benefits outweigh.

## Decision 3: Subscription State Management

**Options Considered:**

1. **Stripe as source of truth** — Query Stripe API for current status on every request
2. **Local cache with webhook sync** — Store subscription state in DB, update via webhooks
3. **Hybrid** — Local cache for reads, Stripe for mutations, webhooks for sync

**Chosen:** Hybrid (local cache + webhook sync)
**Rationale:** NFR-1 requires < 50ms status checks. Querying Stripe API adds 200-500ms latency. Store subscription status locally, keep in sync via webhooks. Mutations (checkout, portal) go through Stripe directly.
**Tradeoffs:** Eventual consistency — brief window where local state may lag behind Stripe. Mitigated by processing webhooks via Inngest with retries.

## Decision 4: Customer Portal for Subscription Management

**Options Considered:**

1. **Stripe Customer Portal** — Hosted page for plan changes, payment updates, cancellation
2. **Custom UI** — Build our own management interface calling Stripe API
3. **Hybrid** — Custom billing dashboard + Stripe Portal for payment method updates

**Chosen:** Hybrid
**Rationale:** Custom billing dashboard (FR-5) for plan info and payment history using local data. Stripe Customer Portal for secure payment method updates and cancellation (avoids PCI scope for card handling). Best of both worlds.
**Tradeoffs:** Two separate interfaces, but each handles what it's best at.
