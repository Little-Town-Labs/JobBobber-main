# Data Model — API-Only Pivot

**Feature:** api-only-pivot
**Date:** 2026-04-30

This document covers only the **additions and modifications** to the existing
Prisma schema. The full existing schema (`prisma/schema.prisma`) is preserved.

---

## New Models

### ApiKey

Stores hashed API keys for programmatic access. The plaintext key is shown once
at creation and never persisted.

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  label       String                          // Human-readable name, e.g. "CI pipeline"
  keyHash     String    @unique               // SHA-256 of the raw key (never store plaintext)
  keyPrefix   String                          // First 8 chars for display, e.g. "jb_live_"
  ownerId     String                          // Clerk userId of the key owner
  ownerType   OwnerType                       // SEEKER | EMPLOYER
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?
  revokedAt   DateTime?

  @@index([ownerId])
  @@index([keyHash])
}

enum OwnerType {
  SEEKER
  EMPLOYER
}
```

**Constraints:**

- Max 10 active (non-revoked) keys per owner — enforced at application layer
- `keyHash` is indexed for O(1) lookup on every authenticated request
- `lastUsedAt` updated asynchronously (fire-and-forget) to avoid adding latency
  to the request path

---

### Webhook

Stores webhook subscriptions for event-driven agent integrations.

```prisma
model Webhook {
  id          String          @id @default(cuid())
  url         String                              // HTTPS endpoint to POST events to
  events      WebhookEvent[]                      // Subscribed event types
  secret      String                              // HMAC-SHA256 signing secret (stored encrypted)
  ownerId     String                              // Clerk userId of the owner
  ownerType   OwnerType                           // SEEKER | EMPLOYER
  active      Boolean         @default(true)
  createdAt   DateTime        @default(now())
  lastFiredAt DateTime?
  failCount   Int             @default(0)         // Consecutive delivery failures

  deliveries  WebhookDelivery[]

  @@index([ownerId])
}

enum WebhookEvent {
  MATCH_CREATED
  MATCH_ACCEPTED
  MATCH_DECLINED
  CONVERSATION_COMPLETED
  SUBSCRIPTION_CHANGED
}
```

**Constraints:**

- Max 5 active webhooks per owner — enforced at application layer
- Webhook URL must be HTTPS; validated at subscription time with a HEAD request
- `secret` encrypted at rest using existing `src/lib/encryption.ts` (AES-256-GCM)
- After 10 consecutive `failCount`, webhook is deactivated and owner is notified

---

### WebhookDelivery

Audit log of individual webhook delivery attempts. Enables debugging and
retry tracking.

```prisma
model WebhookDelivery {
  id          String          @id @default(cuid())
  webhookId   String
  webhook     Webhook         @relation(fields: [webhookId], references: [id])
  event       WebhookEvent
  payload     Json                                // Full payload that was sent
  statusCode  Int?                                // HTTP response code (null if network failure)
  success     Boolean
  attemptNo   Int             @default(1)         // 1-indexed retry count
  createdAt   DateTime        @default(now())

  @@index([webhookId])
  @@index([createdAt])
}
```

---

## Modified Models

### JobSeeker — no schema changes

The `webhookUrl` quick-field approach was rejected in favour of the `Webhook`
model above, which supports multiple subscriptions and per-event filtering.

### Employer — no schema changes

Same rationale as JobSeeker.

### Existing deprecated field cleanup

Remove `urls` field from `JobSeeker` (marked `// DEPRECATED` in Feature 3):

```prisma
// REMOVE this field:
// urls     String[]  // DEPRECATED in Feature 3 — use profileUrls instead
```

Requires a migration:

```sql
ALTER TABLE "JobSeeker" DROP COLUMN IF EXISTS "urls";
```

---

## New Indexes Required

These are not expressible via Prisma's schema DSL for `Unsupported` field types
and must be added via a raw SQL migration:

```sql
-- Vector similarity search optimization (already recommended in archaeology report)
-- Apply after confirming table names match generated Prisma table names

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_seeker_embedding
  ON "JobSeeker" USING ivfflat ("profileEmbedding" vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_posting_embedding
  ON "JobPosting" USING ivfflat ("jobEmbedding" vector_cosine_ops)
  WITH (lists = 100);
```

Note: `lists = 100` is appropriate for tables under 1M rows. Revisit at scale.

---

## Relationship Summary

```
User (Clerk)
  ├── JobSeeker
  │     ├── ApiKey (ownerType=SEEKER, ownerId=clerkUserId)
  │     └── Webhook (ownerType=SEEKER)
  └── Employer
        ├── EmployerMember (existing)
        ├── ApiKey (ownerType=EMPLOYER, ownerId=clerkUserId)
        └── Webhook (ownerType=EMPLOYER)

Webhook
  └── WebhookDelivery (audit log)
```

---

## Webhook Event Notation Mapping

The `WebhookEvent` Prisma enum uses caps-underscore (DB convention). The external
API contract uses dot-notation (event streaming convention). `src/lib/webhooks.ts`
must include an explicit mapping function — do not use the enum value directly
in outbound payloads.

| External API (dot notation) | Prisma enum (caps underscore) |
| --------------------------- | ----------------------------- |
| `match.created`             | `MATCH_CREATED`               |
| `match.accepted`            | `MATCH_ACCEPTED`              |
| `match.declined`            | `MATCH_DECLINED`              |
| `conversation.completed`    | `CONVERSATION_COMPLETED`      |
| `subscription.changed`      | `SUBSCRIPTION_CHANGED`        |

```typescript
// Required in src/lib/webhooks.ts
const WEBHOOK_EVENT_NAMES: Record<WebhookEvent, string> = {
  MATCH_CREATED: "match.created",
  MATCH_ACCEPTED: "match.accepted",
  MATCH_DECLINED: "match.declined",
  CONVERSATION_COMPLETED: "conversation.completed",
  SUBSCRIPTION_CHANGED: "subscription.changed",
}
```

---

## Migration Order

1. Add `OwnerType` enum
2. Add `WebhookEvent` enum
3. Add `ApiKey` model
4. Add `Webhook` model
5. Add `WebhookDelivery` model
6. Drop deprecated `urls` column from `JobSeeker`
7. Add raw SQL migration for pgvector IVFFlat indexes
