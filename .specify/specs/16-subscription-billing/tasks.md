# Task Breakdown — Feature 16: Subscription Billing

**Branch:** 16-subscription-billing
**Plan:** .specify/specs/16-subscription-billing/plan.md
**Total Tasks:** 20
**Phases:** 5

---

## Phase 1: Foundation (flag, schema, plans, Stripe client)

### Task 1.1: Feature Flag & Stripe Client Setup

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None

**Description:**
Add `SUBSCRIPTION_BILLING` feature flag (defaults OFF). Install `stripe` npm package. Create `src/lib/stripe.ts` Stripe client singleton. Add Stripe env var references.

**Acceptance Criteria:**

- [ ] `SUBSCRIPTION_BILLING` flag added to `src/lib/flags.ts` (defaults OFF)
- [ ] `stripe` package installed
- [ ] `src/lib/stripe.ts` exports initialized Stripe client (server-only)
- [ ] Env vars documented: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

### Task 1.2: Prisma Schema Migration

**Status:** 🟡 Ready
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Add billing fields and models to Prisma schema. Create and apply migration.

**Acceptance Criteria:**

- [ ] `stripeCustomerId` (nullable, unique) added to Employer and JobSeeker models
- [ ] `Subscription` model created with all fields from data-model.md
- [ ] `SubscriptionStatus` enum created
- [ ] `StripeEvent` model created with `stripeEventId` unique index
- [ ] Migration applied successfully (`pnpm db:migrate`)
- [ ] All indexes from data-model.md created

---

### Task 1.3: Plan Definitions — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 1h
**Dependencies:** Task 1.1

**Description:**
Write tests for plan definitions and limit constants. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for plan lookup by ID (seeker_free, seeker_pro, employer_free, employer_business)
- [ ] Tests for plan limit constants (conversations/month, active postings)
- [ ] Tests for `getPlanForUser()` utility (returns free plan when no subscription)
- [ ] Tests for Stripe Price ID mapping
- [ ] Tests confirmed to FAIL

---

### Task 1.4: Plan Definitions — Implementation

**Status:** 🔴 Blocked by 1.3
**Effort:** 1h
**Dependencies:** Task 1.3

**Description:**
Create `src/lib/billing-plans.ts` with typed plan definitions, limit constants, and helper functions.

**Acceptance Criteria:**

- [ ] All plans defined: seeker_free, seeker_pro, employer_free, employer_business, employer_enterprise
- [ ] Each plan has: id, name, userType, monthlyPrice, features, limits, stripePriceId
- [ ] `getPlanById()`, `getPlansForUserType()`, `getFreePlan()` utilities
- [ ] `getPlanForUser()` returns current plan or free plan default
- [ ] All tests from 1.3 pass

---

## Phase 2: Stripe Integration (webhooks, checkout, portal)

### Task 2.1: Stripe Webhook Handler — Tests

**Status:** 🔴 Blocked by 1.1, 1.2
**Effort:** 2h
**Dependencies:** Tasks 1.1, 1.2

**Description:**
Write tests for the Stripe webhook route and Inngest event processor. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for webhook signature verification (valid, invalid, missing)
- [ ] Tests for StripeEvent idempotency (duplicate event ID rejected)
- [ ] Tests for event routing: subscription.created, subscription.updated, subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
- [ ] Tests for Subscription model updates (status transitions)
- [ ] Tests for grace period behavior on payment failure
- [ ] Tests confirmed to FAIL

---

### Task 2.2: Stripe Webhook Handler — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2h
**Dependencies:** Task 2.1

**Description:**
Create webhook route and Inngest processor for Stripe events.

**Acceptance Criteria:**

- [ ] `/api/webhooks/stripe/route.ts` verifies signature via `stripe.webhooks.constructEvent()`
- [ ] Returns 401 on invalid signature, 400 on malformed payload
- [ ] Dispatches verified event to Inngest (`billing/stripe.webhook`)
- [ ] Inngest function `process-stripe-event` handles all event types
- [ ] StripeEvent record created for idempotency (skip if already processed)
- [ ] Subscription model updated based on event type
- [ ] Stripe customer ID linked to Employer/JobSeeker on first event
- [ ] Registered in Inngest functions index
- [ ] All tests from 2.1 pass

---

### Task 2.3: Checkout & Portal Sessions — Tests

**Status:** 🔴 Blocked by 1.1, 1.2, 1.4
**Effort:** 1.5h
**Dependencies:** Tasks 1.1, 1.2, 1.4
**Parallel with:** Task 2.1

**Description:**
Write tests for Stripe Checkout and Portal session creation. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for checkout session creation (seeker Pro, employer Business)
- [ ] Tests for Stripe customer creation (new user, existing user)
- [ ] Tests for coupon code application at checkout
- [ ] Tests for portal session creation (existing customer required)
- [ ] Tests for error handling (no Stripe customer, invalid plan)
- [ ] Tests confirmed to FAIL

---

### Task 2.4: Checkout & Portal Sessions — Implementation

**Status:** 🔴 Blocked by 2.3
**Effort:** 1.5h
**Dependencies:** Task 2.3

**Description:**
Implement Stripe Checkout and Customer Portal session creation utilities.

**Acceptance Criteria:**

- [ ] `createCheckoutSession(userId, planId, couponCode?)` creates Stripe Checkout Session
- [ ] Creates Stripe Customer if none exists, links to Employer/JobSeeker
- [ ] Sets success/cancel URLs with proper redirects
- [ ] `createPortalSession(customerId)` creates Stripe Portal session
- [ ] Coupon code passed to Checkout Session when provided
- [ ] All tests from 2.3 pass

---

## Phase 3: Billing Router & Usage Enforcement

### Task 3.1: Plan Limit Enforcement — Tests

**Status:** 🔴 Blocked by 1.4, 1.2
**Effort:** 1.5h
**Dependencies:** Tasks 1.2, 1.4

**Description:**
Write tests for usage limit checking and enforcement. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for seeker conversation limit (free: capped, pro: unlimited)
- [ ] Tests for employer posting limit (free: 1, business: unlimited)
- [ ] Tests for employer conversation limit (free: capped, business: unlimited)
- [ ] Tests for limit check with no subscription (defaults to free tier)
- [ ] Tests for limit check when flag is OFF (all limits bypassed)
- [ ] Tests for LimitCheck response shape (allowed, currentUsage, limit, message)
- [ ] Tests confirmed to FAIL

---

### Task 3.2: Plan Limit Enforcement — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5h
**Dependencies:** Task 3.1

**Description:**
Create `src/lib/plan-limits.ts` with usage checking utilities.

**Acceptance Criteria:**

- [ ] `checkConversationLimit(db, userId, userType)` → LimitCheck
- [ ] `checkPostingLimit(db, employerId)` → LimitCheck
- [ ] Derives counts from AgentConversation and JobPosting tables
- [ ] Returns `{ allowed, currentUsage, limit, upgradeRequired, message }`
- [ ] Bypasses limits when `SUBSCRIPTION_BILLING` flag is OFF
- [ ] All tests from 3.1 pass

---

### Task 3.3: Billing Router — Tests

**Status:** 🔴 Blocked by 1.4, 2.4, 3.2
**Effort:** 2h
**Dependencies:** Tasks 1.4, 2.4, 3.2

**Description:**
Write tests for all billing tRPC procedures. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for `getPlans` (seeker and employer types)
- [ ] Tests for `getSubscription` (active, null, expired)
- [ ] Tests for `getUsage` (seeker and employer)
- [ ] Tests for `getPaymentHistory` (with invoices, empty)
- [ ] Tests for `createCheckoutSession` (valid plan, invalid plan, authorization)
- [ ] Tests for `createPortalSession` (existing customer, no customer)
- [ ] Tests for `checkLimit` (conversation, posting actions)
- [ ] Tests for feature flag gating (all procedures return 404 when OFF)
- [ ] Tests confirmed to FAIL

---

### Task 3.4: Billing Router — Implementation

**Status:** 🔴 Blocked by 3.3
**Effort:** 2h
**Dependencies:** Task 3.3

**Description:**
Create `src/server/api/routers/billing.ts` with all procedures and register in root.

**Acceptance Criteria:**

- [ ] All 7 procedures implemented per billing-api.yaml contract
- [ ] `getPlans`: protectedProcedure, returns typed plan array
- [ ] `getSubscription`: protectedProcedure, queries local Subscription table
- [ ] `getUsage`: protectedProcedure, derives usage from existing tables
- [ ] `getPaymentHistory`: protectedProcedure, fetches from Stripe API
- [ ] `createCheckoutSession`: seekerProcedure/adminProcedure, validates plan ownership
- [ ] `createPortalSession`: protectedProcedure, requires stripeCustomerId
- [ ] `checkLimit`: protectedProcedure, uses plan-limits utilities
- [ ] All procedures gated behind `SUBSCRIPTION_BILLING` flag
- [ ] Router registered in `src/server/api/root.ts`
- [ ] All tests from 3.3 pass

---

### Task 3.5: Integration Points — Limit Enforcement

**Status:** 🔴 Blocked by 3.2
**Effort:** 1h
**Dependencies:** Task 3.2

**Description:**
Wire limit checks into existing conversation and posting creation flows.

**Acceptance Criteria:**

- [ ] Conversation creation checks `checkConversationLimit` before proceeding
- [ ] Posting creation checks `checkPostingLimit` before proceeding
- [ ] Limit errors return structured response with upgrade path
- [ ] All existing tests still pass (limits bypassed when flag OFF)
- [ ] No behavior change when `SUBSCRIPTION_BILLING` flag is OFF

---

## Phase 4: Billing UI

### Task 4.1: Pricing Page — Tests

**Status:** 🔴 Blocked by 3.4
**Effort:** 1h
**Dependencies:** Task 3.4
**Parallel with:** Task 4.3

**Description:**
Write component tests for the pricing page. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for plan card rendering (name, price, features)
- [ ] Tests for current plan highlighting
- [ ] Tests for upgrade CTA button
- [ ] Tests for Enterprise "Contact Sales" display
- [ ] Tests confirmed to FAIL

---

### Task 4.2: Pricing Page — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 1.5h
**Dependencies:** Task 4.1

**Description:**
Create pricing page component and route.

**Acceptance Criteria:**

- [ ] `src/components/billing/pricing-table.tsx` renders plan comparison
- [ ] Seeker pricing page at `/pricing` or within seeker settings
- [ ] Employer pricing page at `/pricing` or within employer dashboard
- [ ] Current plan highlighted, upgrade CTA functional
- [ ] Enterprise tier shows "Contact Sales"
- [ ] All tests from 4.1 pass

---

### Task 4.3: Billing Dashboard — Tests

**Status:** 🔴 Blocked by 3.4
**Effort:** 1h
**Dependencies:** Task 3.4
**Parallel with:** Task 4.1

**Description:**
Write component tests for the billing dashboard. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for current plan display (name, price, renewal date)
- [ ] Tests for usage meters (conversations, postings)
- [ ] Tests for payment history table (date, amount, status, invoice link)
- [ ] Tests for action buttons (upgrade, manage payment, cancel)
- [ ] Tests for free tier state (no payment history, upgrade prompt)
- [ ] Tests confirmed to FAIL

---

### Task 4.4: Billing Dashboard — Implementation

**Status:** 🔴 Blocked by 4.3
**Effort:** 2h
**Dependencies:** Task 4.3

**Description:**
Create billing dashboard pages for both user types.

**Acceptance Criteria:**

- [ ] `src/app/(employer)/dashboard/billing/page.tsx` for employers
- [ ] `src/app/(seeker)/settings/billing/page.tsx` for seekers
- [ ] Shows current plan, usage meters, payment history
- [ ] "Upgrade" button creates checkout session and redirects
- [ ] "Manage Payment" button creates portal session and redirects
- [ ] Checkout success/cancel redirect pages created
- [ ] Navigation links added to existing dashboards
- [ ] All tests from 4.3 pass

---

### Task 4.5: Upgrade Prompts

**Status:** 🔴 Blocked by 3.5, 4.2
**Effort:** 1h
**Dependencies:** Tasks 3.5, 4.2

**Description:**
Add contextual upgrade prompts when users hit plan limits.

**Acceptance Criteria:**

- [ ] When conversation limit hit: show message with plan details and upgrade button
- [ ] When posting limit hit: show message with plan details and upgrade button
- [ ] Prompts link to pricing page or directly create checkout session
- [ ] Prompts only shown when `SUBSCRIPTION_BILLING` flag is ON

---

## Phase 5: Quality & Polish

### Task 5.1: Security Review

**Status:** 🔴 Blocked by 2.2, 3.4
**Effort:** 1h
**Dependencies:** Tasks 2.2, 3.4

**Description:**
Run `/security-review` on all billing code.

**Acceptance Criteria:**

- [ ] Webhook signature verification confirmed correct
- [ ] No Stripe secret key exposed to client
- [ ] Authorization checks on all mutation procedures
- [ ] No raw payment data stored in database
- [ ] Idempotency verified for webhook processing
- [ ] All CRITICAL/HIGH issues resolved

---

### Task 5.2: Code Review & Final Tests

**Status:** 🔴 Blocked by all Phase 4 tasks, 5.1
**Effort:** 1h
**Dependencies:** All previous tasks

**Description:**
Run `/code-review`, verify test coverage, run full suite.

**Acceptance Criteria:**

- [ ] Code review passed (no CRITICAL issues)
- [ ] Test coverage ≥ 80% on billing code
- [ ] Full test suite passes with no regressions
- [ ] Feature flag ON/OFF behavior verified end-to-end
- [ ] Ready for PR/merge

---

## Dependency Graph

```
Phase 1 (Foundation):
  1.1 (flag/stripe) ─┬─→ 1.3 → 1.4 (plans)
  1.2 (schema)    ───┤
                     │
Phase 2 (Stripe):    ├─→ 2.1 → 2.2 (webhooks)
                     └─→ 2.3 → 2.4 (checkout/portal)
                              │
Phase 3 (Router):    1.2,1.4 → 3.1 → 3.2 (limits)
                     1.4,2.4,3.2 → 3.3 → 3.4 (router)
                     3.2 → 3.5 (integration points)
                              │
Phase 4 (UI):        3.4 ─┬─→ 4.1 → 4.2 (pricing)
                          └─→ 4.3 → 4.4 (dashboard)
                     3.5,4.2 → 4.5 (upgrade prompts)
                              │
Phase 5 (Quality):   2.2,3.4 → 5.1 (security)
                     all → 5.2 (final review)
```

## Critical Path

```
1.1 → 1.3 → 1.4 → 3.1 → 3.2 → 3.3 → 3.4 → 4.3 → 4.4 → 5.2
```

## Parallelization Opportunities

- **1.1 ∥ 1.2** — Flag/Stripe setup and schema migration are independent
- **2.1 ∥ 2.3** — Webhook tests and checkout tests are independent
- **3.1 ∥ 2.1** — Limit tests can start once schema exists
- **4.1 ∥ 4.3** — Pricing page and billing dashboard tests are independent
- **5.1 can start** as soon as webhooks and router are done (doesn't need UI)

## User Story → Task Mapping

| User Story                  | Tasks                                  |
| --------------------------- | -------------------------------------- |
| US-1: View Plans            | 1.3, 1.4, 3.3, 3.4, 4.1, 4.2           |
| US-2: Seeker Upgrades       | 2.3, 2.4, 3.3, 3.4, 4.2                |
| US-3: Employer Selects Plan | 1.3, 1.4, 2.3, 2.4, 3.3, 3.4, 4.1, 4.2 |
| US-4: Manage Subscription   | 2.3, 2.4, 3.3, 3.4, 4.3, 4.4           |
| US-5: Free Tier Limits      | 3.1, 3.2, 3.5, 4.5                     |
| US-6: Upgrade/Downgrade     | 2.1, 2.2, 3.3, 3.4, 4.5                |
| US-7: Beta Pricing          | 2.3, 2.4                               |
