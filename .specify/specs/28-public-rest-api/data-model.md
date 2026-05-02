# Data Model: Feature 28 — Public REST API

## New Enums

### WebhookEventType

```prisma
enum WebhookEventType {
  MATCH_CREATED
  MATCH_ACCEPTED
  MATCH_DECLINED
}
```

### WebhookDeliveryStatus

```prisma
enum WebhookDeliveryStatus {
  PENDING
  SUCCESS
  FAILED
}
```

## New Models

### ApiKey

API key for external programmatic access. Raw key shown once at creation, stored as irreversible SHA-256 hash. Scoped to a single Employer.

| Field      | Type      | Constraints  | Description                                |
| ---------- | --------- | ------------ | ------------------------------------------ |
| id         | String    | PK, CUID     | Unique identifier                          |
| employerId | String    | FK, Not Null | Owning employer                            |
| label      | String?   | Optional     | Descriptive name ("ATS Integration")       |
| keyHash    | String    | Unique       | SHA-256 hash of raw API key                |
| keyPrefix  | String    | Not Null     | First 8 chars for display ("jb_live_a1b2") |
| lastUsedAt | DateTime? | Optional     | Updated on each API request                |
| revokedAt  | DateTime? | Optional     | Null = active; non-null = revoked          |
| createdAt  | DateTime  | Default now  | Creation timestamp                         |

**Indexes:** `employerId`, `keyHash` (unique)
**Relations:** Employer (cascade delete)
**Table:** `api_keys`

### WebhookSubscription

Webhook endpoint for real-time event notifications. Per-event filtering.

| Field           | Type               | Constraints  | Description                            |
| --------------- | ------------------ | ------------ | -------------------------------------- |
| id              | String             | PK, CUID     | Unique identifier                      |
| employerId      | String             | FK, Not Null | Owning employer                        |
| url             | String             | Not Null     | Target URL for POST requests           |
| events          | WebhookEventType[] | Not Null     | Subscribed event types                 |
| secretEncrypted | String             | Not Null     | AES-256-GCM encrypted HMAC secret      |
| secretPrefix    | String             | Not Null     | Last 4 chars of raw secret for display |
| isActive        | Boolean            | Default true | Active/paused status                   |
| createdAt       | DateTime           | Default now  | Creation timestamp                     |
| updatedAt       | DateTime           | Auto         | Last update timestamp                  |

**Indexes:** `employerId`, `[employerId, isActive]`
**Relations:** Employer (cascade delete), WebhookDelivery[] (has many)
**Table:** `webhook_subscriptions`

### WebhookDelivery

Individual webhook delivery attempt for debugging and audit.

| Field          | Type                  | Constraints     | Description                                 |
| -------------- | --------------------- | --------------- | ------------------------------------------- |
| id             | String                | PK, CUID        | Unique identifier                           |
| subscriptionId | String                | FK, Not Null    | Parent subscription                         |
| eventType      | WebhookEventType      | Not Null        | Event that triggered delivery               |
| payload        | Json                  | Not Null        | JSON payload sent                           |
| httpStatus     | Int?                  | Optional        | Response status (null if connection failed) |
| responseBody   | String?               | Optional        | First 500 chars of response                 |
| attemptNumber  | Int                   | Default 1       | 1 = initial, 2-4 = retries                  |
| status         | WebhookDeliveryStatus | Default PENDING | Delivery lifecycle                          |
| deliveredAt    | DateTime?             | Optional        | When delivery succeeded                     |
| failedAt       | DateTime?             | Optional        | When all retries exhausted                  |
| error          | String?               | Optional        | Error message on failure                    |
| inngestRunId   | String?               | Optional        | Inngest run ID for correlation              |
| createdAt      | DateTime              | Default now     | Creation timestamp                          |

**Indexes:** `subscriptionId`, `[subscriptionId, createdAt]`, `status`
**Relations:** WebhookSubscription (cascade delete)
**Table:** `webhook_deliveries`

## Employer Model Changes

Add relations to existing Employer model:

```prisma
model Employer {
  // ... existing fields ...
  apiKeys              ApiKey[]
  webhookSubscriptions WebhookSubscription[]
}
```

## Design Decisions

- **`revokedAt` as DateTime** (not boolean): Captures when revocation happened for actionable error messages.
- **`keyHash` unique**: O(1) lookup. 256-bit entropy makes collisions astronomically unlikely.
- **`events` as PostgreSQL array**: Per-event filtering without a join table.
- **`secretEncrypted`**: Uses existing `encrypt()` with `scopeId = subscriptionId`. Must be decryptable to compute HMAC signatures.
- **Cascade delete on Employer**: Consistent with existing JobPosting, EmployerMember cascades.
- **`attemptNumber` per delivery row**: Updated in-place as retries happen (not one row per attempt).

## Entity Relationships

```
Employer (1) ──── (*) ApiKey
Employer (1) ──── (*) WebhookSubscription
WebhookSubscription (1) ──── (*) WebhookDelivery
```

## Migration Notes

- All new tables — no data migration required
- New enum types created automatically by Prisma
- No foreign keys to Clerk tables (follows existing pattern)
