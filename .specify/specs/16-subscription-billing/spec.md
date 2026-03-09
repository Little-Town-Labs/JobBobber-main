# Feature 16: Subscription Billing

**Branch:** 16-subscription-billing
**Status:** Draft
**Priority:** P0
**Feature Flag:** `SUBSCRIPTION_BILLING` (launches OFF by default)

---

## Overview

JobBobber needs a subscription billing system that monetizes the platform across two user types (job seekers and employers) with tiered plans. Free tiers provide capped access to validate value before committing. Paid tiers unlock unlimited agent activity, multi-posting, and advanced features. The billing system must handle plan upgrades, downgrades, cancellations, and usage enforcement transparently. An introductory beta pricing period is supported via promotional discounts.

**Business Value:** Enables sustainable revenue generation while maintaining a free tier for user acquisition and product validation.

---

## User Stories

### User Story 1: Job Seeker Views Available Plans

**As a** job seeker
**I want** to see available subscription plans and what each includes
**So that** I can decide whether upgrading from the free tier is worth it

**Acceptance Criteria:**

- [ ] Pricing page displays Free and Pro ($39/mo) plans with feature comparison
- [ ] Current plan is visually highlighted
- [ ] Feature differences are clearly listed (agent activity limits, full features)
- [ ] Upgrade CTA is prominent on the Free plan

**Priority:** High

---

### User Story 2: Job Seeker Upgrades to Pro

**As a** job seeker on the free tier
**I want** to upgrade to Pro
**So that** I get unlimited agent activity and full platform features

**Acceptance Criteria:**

- [ ] User can initiate checkout from billing dashboard or pricing page
- [ ] Secure payment flow collects card details without storing raw payment data on platform
- [ ] After successful payment, Pro features activate immediately
- [ ] Confirmation shown with plan details and next billing date
- [ ] Receipt/invoice available for download

**Priority:** High

---

### User Story 3: Employer Selects a Plan

**As an** employer
**I want** to choose between Free, Business ($99/mo), and Enterprise (custom) plans
**So that** I get the right level of service for my hiring needs

**Acceptance Criteria:**

- [ ] Pricing page displays all three employer tiers with feature comparison
- [ ] Free tier: 1 active job posting, capped agent conversations
- [ ] Business tier: multiple active postings, unlimited agent conversations
- [ ] Enterprise tier: shows "Contact Sales" with inquiry form or link
- [ ] Current plan is visually highlighted

**Priority:** High

---

### User Story 4: User Manages Subscription

**As a** subscribed user (seeker or employer)
**I want** to view my current plan, update payment method, and cancel
**So that** I have full control over my billing

**Acceptance Criteria:**

- [ ] Billing dashboard shows current plan name, price, and renewal date
- [ ] User can update payment method via secure portal
- [ ] User can cancel subscription; access continues until end of billing period
- [ ] User can view payment history with dates, amounts, and invoice links
- [ ] Cancelled users revert to Free tier limits at period end

**Priority:** High

---

### User Story 5: Free Tier Limits Are Enforced

**As a** platform operator
**I want** free tier usage limits enforced at the system level
**So that** users cannot bypass restrictions without upgrading

**Acceptance Criteria:**

- [ ] Job seeker free tier: agent activity capped (e.g., max conversations per month)
- [ ] Employer free tier: limited to 1 active job posting
- [ ] Employer free tier: agent conversations capped per posting
- [ ] When a limit is reached, user sees a clear message explaining the limit and an upgrade prompt
- [ ] Limits are enforced server-side (not just UI), returning appropriate errors

**Priority:** High

---

### User Story 6: Plan Upgrade and Downgrade

**As a** subscribed user
**I want** to change my plan (upgrade or downgrade)
**So that** my subscription matches my current needs

**Acceptance Criteria:**

- [ ] Upgrade takes effect immediately with prorated billing
- [ ] Downgrade takes effect at end of current billing period
- [ ] User is informed of what changes and when before confirming
- [ ] Feature access adjusts according to new plan at the effective date

**Priority:** Medium

---

### User Story 7: Beta Pricing

**As a** platform operator
**I want** to offer introductory beta pricing via promotional discounts
**So that** early adopters get a lower price during the beta period

**Acceptance Criteria:**

- [ ] Promotional discount can be applied at checkout
- [ ] Discounted price is clearly shown alongside original price
- [ ] Discount terms (duration, expiration) are transparent to the user
- [ ] Discount is automatically removed when the promotional period ends

**Priority:** Medium

---

## Functional Requirements

### FR-1: Subscription Plan Definitions

The system shall support the following subscription tiers:

- **Job Seeker Free:** Capped agent activity, basic features
- **Job Seeker Pro ($39/mo):** Unlimited agent activity, all features
- **Employer Free:** 1 active posting, capped agent conversations
- **Employer Business ($99/mo):** Multiple postings, unlimited conversations
- **Employer Enterprise (custom):** Custom pricing, dedicated support, contact sales flow

### FR-2: Checkout Flow

Users shall be able to initiate a subscription checkout that collects payment details securely. No raw payment data (card numbers, CVVs) shall be stored on the platform. The checkout shall redirect users to a hosted, PCI-compliant payment page.

### FR-3: Subscription Lifecycle Events

The system shall handle the following lifecycle events:

- Subscription created (activate features)
- Payment succeeded (continue access)
- Payment failed (grace period, then restrict access)
- Subscription cancelled (access until period end, then revert to Free)
- Subscription upgraded (immediate feature upgrade, prorated charge)
- Subscription downgraded (features change at period end)

### FR-4: Usage Limit Enforcement

Free tier limits shall be enforced at the API level (server-side). Enforcement checks run before any rate-limited operation. When a limit is exceeded, the system returns a clear error with the specific limit hit and an upgrade path.

### FR-5: Billing Dashboard

Each user shall have a billing dashboard displaying:

- Current plan name and monthly price
- Next billing date (or cancellation date if cancelled)
- Payment method summary (last 4 digits, expiry)
- Payment history (date, amount, status, invoice link)
- Actions: upgrade, downgrade, cancel, update payment method

### FR-6: Feature Flag Gating

All subscription billing functionality shall be gated behind a `SUBSCRIPTION_BILLING` feature flag that defaults to OFF. When OFF:

- All users have unrestricted access (no tier limits enforced)
- Billing dashboard and pricing pages are hidden
- Checkout flows are inaccessible

When ON:

- Tier limits enforced based on user's active subscription
- Billing UI visible and functional

### FR-7: Webhook Event Processing

Subscription lifecycle events from the payment provider shall be processed asynchronously via background jobs. Events shall be idempotent (reprocessing the same event produces the same result). Failed event processing shall retry with exponential backoff.

### FR-8: Invoice and Receipt Access

Users shall be able to access invoices and receipts for all past payments. These shall be generated by the payment provider, not the platform.

---

## Non-Functional Requirements

### NFR-1: Security

- No raw payment data stored on platform (PCI compliance delegated to provider)
- Webhook endpoints shall verify event authenticity via signatures
- Billing operations require authenticated sessions
- Payment method updates handled via provider's secure portal

### NFR-2: Performance

- Subscription status checks shall complete in < 50ms (cached locally)
- Webhook events shall be processed within 30 seconds of receipt
- Billing dashboard shall load within 1 second

### NFR-3: Reliability

- Webhook processing shall be idempotent and retry-safe
- Payment failure shall trigger a grace period (3-7 days) before restricting access
- Subscription state shall be eventually consistent with the payment provider

### NFR-4: Usability

- Pricing comparison shall be clear and scannable
- Cancellation flow shall not use dark patterns (no excessive retention screens)
- All monetary amounts displayed with currency symbol and formatted per locale

---

## Edge Cases & Error Handling

### EC-1: Payment Fails During Checkout

User sees a clear error message. No subscription is created. User can retry with a different payment method.

### EC-2: Recurring Payment Fails

System enters a grace period (configurable, 3-7 days). User is notified via email. If payment is not resolved within the grace period, subscription is cancelled and user reverts to Free tier.

### EC-3: User Cancels Mid-Billing Period

Access continues until the end of the current billing period. After period ends, user reverts to Free tier. No partial refunds (standard SaaS practice).

### EC-4: Duplicate Webhook Events

Webhook handler is idempotent. Processing the same event ID multiple times produces the same result. Events are deduplicated by provider event ID.

### EC-5: User Attempts to Exceed Free Tier Limits

Server-side enforcement returns a structured error with:

- Which limit was hit (e.g., "1 active posting limit")
- Current usage vs. limit
- Link/action to upgrade

### EC-6: Employer With Active Postings Downgrades to Free

Excess postings beyond the Free tier limit are paused (not deleted) at the downgrade effective date. User is notified which postings were paused.

### EC-7: Feature Flag Toggled ON for Existing Users

When `SUBSCRIPTION_BILLING` is enabled, existing users without a subscription default to the Free tier. No data migration is needed — absence of subscription record implies Free tier.

### EC-8: Enterprise Inquiry

Enterprise tier shows a contact form or link. No self-service checkout. Inquiry is logged for the sales team.

---

## Success Metrics

- Checkout completion rate > 70%
- Webhook processing success rate > 99.9%
- Zero instances of raw payment data in platform logs or database
- Free tier limit enforcement has zero server-side bypasses
- Billing dashboard loads in < 1 second (p95)

---

## Out of Scope

- Annual billing (monthly only for MVP)
- Multiple currencies (USD only for MVP)
- Usage-based billing (flat monthly rate only)
- Refund processing (handled manually via payment provider dashboard)
- Tax calculation (delegated to payment provider)
