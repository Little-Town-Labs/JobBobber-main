# Data Model — Feature 16: Subscription Billing

## New Fields on Existing Models

### Employer (add fields)

| Field            | Type    | Constraints | Description                  |
| ---------------- | ------- | ----------- | ---------------------------- |
| stripeCustomerId | String? | Unique      | Stripe Customer ID (cus_xxx) |

### JobSeeker (add fields)

| Field            | Type    | Constraints | Description                  |
| ---------------- | ------- | ----------- | ---------------------------- |
| stripeCustomerId | String? | Unique      | Stripe Customer ID (cus_xxx) |

## New Models

### Subscription

| Field                | Type     | Constraints          | Description                                               |
| -------------------- | -------- | -------------------- | --------------------------------------------------------- |
| id                   | String   | PK, cuid             | Internal ID                                               |
| stripeSubscriptionId | String   | Unique               | Stripe Subscription ID (sub_xxx)                          |
| stripeCustomerId     | String   | Not Null             | Stripe Customer ID                                        |
| userId               | String   | Not Null             | Clerk user ID (owner)                                     |
| userType             | Enum     | JOB_SEEKER, EMPLOYER | Which user type                                           |
| employerId           | String?  | FK → Employer        | Set for employer subscriptions                            |
| seekerId             | String?  | FK → JobSeeker       | Set for seeker subscriptions                              |
| planId               | String   | Not Null             | Plan identifier (e.g., "seeker_pro", "employer_business") |
| status               | Enum     | See below            | Current subscription status                               |
| currentPeriodStart   | DateTime | Not Null             | Billing period start                                      |
| currentPeriodEnd     | DateTime | Not Null             | Billing period end                                        |
| cancelAtPeriodEnd    | Boolean  | Default false        | Whether cancellation is pending                           |
| createdAt            | DateTime | Default now          | Record creation                                           |
| updatedAt            | DateTime | Auto                 | Last update                                               |

### SubscriptionStatus Enum

- ACTIVE
- PAST_DUE (payment failed, in grace period)
- CANCELLED (cancelled but still in paid period)
- EXPIRED (billing period ended after cancellation)
- INCOMPLETE (checkout started but not completed)

### StripeEvent

| Field         | Type      | Constraints   | Description                                    |
| ------------- | --------- | ------------- | ---------------------------------------------- |
| id            | String    | PK, cuid      | Internal ID                                    |
| stripeEventId | String    | Unique        | Stripe event ID (evt_xxx) for idempotency      |
| type          | String    | Not Null      | Event type (e.g., "invoice.payment_succeeded") |
| processed     | Boolean   | Default false | Whether event has been processed               |
| processedAt   | DateTime? |               | When processing completed                      |
| payload       | Json      | Not Null      | Raw event payload                              |
| createdAt     | DateTime  | Default now   | Record creation                                |

## Relationships

- Employer 1:N Subscription (an employer may have historical subscriptions)
- JobSeeker 1:N Subscription
- No FK from Subscription to StripeEvent (events are independent)

## Indexes

- `Subscription.stripeSubscriptionId` — unique, lookup by Stripe ID
- `Subscription.stripeCustomerId` — lookup all subs for a customer
- `Subscription.userId` — lookup by Clerk user
- `Subscription.employerId` — lookup active employer subscription
- `Subscription.seekerId` — lookup active seeker subscription
- `StripeEvent.stripeEventId` — unique, idempotency check
- `StripeEvent.processed` — find unprocessed events
- `Employer.stripeCustomerId` — unique, reverse lookup
- `JobSeeker.stripeCustomerId` — unique, reverse lookup

## Plan Definitions (Application Constants, Not DB)

Plans are defined as application constants (not a DB table) since they map directly to Stripe Price IDs:

| Plan ID             | User Type  | Name       | Monthly Price | Limits                                      |
| ------------------- | ---------- | ---------- | ------------- | ------------------------------------------- |
| seeker_free         | JOB_SEEKER | Free       | $0            | Max 5 conversations/month                   |
| seeker_pro          | JOB_SEEKER | Pro        | $39           | Unlimited                                   |
| employer_free       | EMPLOYER   | Free       | $0            | 1 active posting, 10 conversations/month    |
| employer_business   | EMPLOYER   | Business   | $99           | Unlimited postings, unlimited conversations |
| employer_enterprise | EMPLOYER   | Enterprise | Custom        | Contact sales                               |

## Usage Tracking (for Free Tier Enforcement)

Usage counters are derived from existing data — no new usage tracking table needed:

- **Seeker conversations/month:** `COUNT(AgentConversation WHERE seekerId = X AND createdAt >= monthStart)`
- **Employer active postings:** `COUNT(JobPosting WHERE employerId = X AND status = 'ACTIVE')`
- **Employer conversations/month:** `COUNT(AgentConversation WHERE jobPostingId IN (employer's postings) AND createdAt >= monthStart)`

## Migration Strategy

- Add `stripeCustomerId` as nullable field on Employer and JobSeeker (no breaking change)
- Create Subscription and StripeEvent tables
- Existing users without subscriptions default to Free tier (EC-7 in spec)
- No data backfill needed
