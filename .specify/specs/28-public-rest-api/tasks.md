# Task Breakdown: Feature 28 — Public REST API

**Plan:** .specify/specs/28-public-rest-api/plan.md
**Total Tasks:** 28
**Total Effort:** ~28 hours
**Critical Path:** 0.1 → 0.4 → 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 5.1 → 5.6

---

## Phase 0: Data Model & Infrastructure

### Task 0.1: Prisma Schema + Migration

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None

**Description:**
Add `ApiKey`, `WebhookSubscription`, `WebhookDelivery` models and `WebhookEventType`, `WebhookDeliveryStatus` enums. Add relations on `Employer`. Run migration.

**Acceptance Criteria:**

- [ ] `ApiKey` model with `keyHash` (unique), `keyPrefix`, `revokedAt`, `lastUsedAt`
- [ ] `WebhookSubscription` model with `events` array, `secretEncrypted`, `isActive`
- [ ] `WebhookDelivery` model with `payload`, `httpStatus`, `attemptNumber`, `status`
- [ ] Employer relations added (`apiKeys`, `webhookSubscriptions`)
- [ ] `prisma migrate dev` succeeds
- [ ] `prisma generate` produces correct types

---

### Task 0.2: Feature Flag + Rate Limit Category

**Status:** 🟡 Ready
**Effort:** 0.25h
**Dependencies:** None
**Parallel with:** Task 0.1

**Description:**
Add infrastructure config.

**Acceptance Criteria:**

- [ ] `PUBLIC_API` flag added to `src/lib/flags.ts`
- [ ] `api` category added to `RATE_LIMIT_CATEGORIES` in `src/lib/rate-limit.ts`: `{ requests: 100, window: "1m" }`

---

### Task 0.3: API Key Utility Tests

**Status:** 🟡 Ready
**Effort:** 0.5h
**Dependencies:** None
**Parallel with:** Tasks 0.1, 0.2

**Description:**
Write tests for API key utilities. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/lib/api-key.test.ts` written
- [ ] Tests cover: key generation format (`jb_live_` prefix, 32 bytes), hash determinism, timing-safe comparison (correct key, wrong key), prefix extraction
- [ ] Tests confirmed to FAIL

---

### Task 0.4: API Key Utility Implementation

**Status:** 🔴 Blocked by 0.3
**Effort:** 0.5h
**Dependencies:** Task 0.3

**Description:**
Implement API key generation, hashing, and comparison.

**Acceptance Criteria:**

- [ ] `src/lib/api-key.ts` created
- [ ] `generateApiKey()` — returns `{ raw, hash, prefix }` using `crypto.randomBytes(32)`
- [ ] `hashApiKey(raw)` — SHA-256 hash for lookup
- [ ] `verifyApiKeyHash(raw, stored)` — timing-safe comparison via `crypto.timingSafeEqual`
- [ ] All tests from 0.3 pass

---

## Phase 1: API Key Management (tRPC + UI)

### Task 1.1: Integrations Router Tests

**Status:** 🔴 Blocked by 0.1, 0.4
**Effort:** 2h
**Dependencies:** Tasks 0.1, 0.4

**Description:**
Write tests for the integrations tRPC router. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/server/api/routers/integrations.test.ts` written
- [ ] Tests cover API keys: create (returns raw key once), list (no raw key), revoke (idempotent), max 10 enforcement, scoped to employer
- [ ] Tests cover webhooks: create (validates URL), list, delete, per-event filtering, max 5 enforcement
- [ ] Tests cover: NOT_FOUND when PUBLIC_API flag disabled
- [ ] All tests confirmed to FAIL

---

### Task 1.2: Integrations Router Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 2h
**Dependencies:** Task 1.1

**Description:**
Implement tRPC router for API key and webhook management.

**Acceptance Criteria:**

- [ ] `src/server/api/routers/integrations.ts` created
- [ ] `apiKeys.create` — generates key, stores hash, returns raw key once
- [ ] `apiKeys.list` — returns label, prefix, createdAt, lastUsedAt (no raw key)
- [ ] `apiKeys.revoke` — sets `revokedAt`, idempotent
- [ ] `webhooks.create` — validates URL format, stores subscription + encrypted secret
- [ ] `webhooks.list` — returns URL, events, active status
- [ ] `webhooks.delete` — soft delete via `isActive = false`
- [ ] `webhooks.test` — sends test payload to URL
- [ ] All procedures gate on `PUBLIC_API` flag
- [ ] All tests from 1.1 pass

---

### Task 1.3: Router Registration

**Status:** 🔴 Blocked by 1.2
**Effort:** 0.25h
**Dependencies:** Task 1.2

**Description:**
Register router and add typed hooks.

**Acceptance Criteria:**

- [ ] `integrations` router registered in `src/server/api/root.ts`
- [ ] Typed hooks added to `src/lib/trpc/hooks.ts`

---

### Task 1.4: Integrations Page + Components

**Status:** 🔴 Blocked by 1.3
**Effort:** 2h
**Dependencies:** Task 1.3

**Description:**
Build the integrations management UI.

**Acceptance Criteria:**

- [ ] `src/app/(employer)/dashboard/integrations/page.tsx` — two sections: API Keys, Webhooks
- [ ] `src/components/integrations/api-key-manager.tsx` — create dialog (label input), key display dialog (show once, copy button), list with revoke action
- [ ] `src/components/integrations/webhook-manager.tsx` — create dialog (URL + event checkboxes), list with delete and test actions
- [ ] Gated behind `PUBLIC_API` flag

---

### Task 1.5: Security Review — API Key Management

**Status:** 🔴 Blocked by 1.2
**Effort:** 0.5h
**Dependencies:** Task 1.2

**Description:**
Security review of API key creation, storage, and revocation.

**Acceptance Criteria:**

- [ ] Raw key never stored (only hash)
- [ ] Raw key shown exactly once in response
- [ ] No raw key in logs or error messages
- [ ] Revocation is immediate (no caching)
- [ ] Webhook secrets encrypted at rest via `encrypt()`

---

## Phase 2: REST API Endpoints

### Task 2.1: API Middleware Tests

**Status:** 🔴 Blocked by 0.4
**Effort:** 1.5h
**Dependencies:** Task 0.4

**Description:**
Write tests for API middleware. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/lib/api-middleware.test.ts` written
- [ ] Tests cover: valid key auth, revoked key (401), missing Authorization header (401), malformed header (401), rate limit enforcement (429), feature flag gate (404), `lastUsedAt` update, JSON envelope format
- [ ] Tests confirmed to FAIL

---

### Task 2.2: API Middleware Implementation

**Status:** 🔴 Blocked by 0.2, 2.1
**Effort:** 1h
**Dependencies:** Tasks 0.2, 2.1

**Description:**
Implement API authentication, rate limiting, and response wrapper. Depends on Task 0.2 for the `api` rate-limit category (TypeScript won't compile without it).

**Acceptance Criteria:**

- [ ] `src/lib/api-middleware.ts` created
- [ ] `authenticateApiKey(req)` — extracts Bearer token, hashes, looks up ApiKey, loads Employer, checks revocation, updates `lastUsedAt`
- [ ] `withApiResponse(handler)` — wraps with try/catch, feature flag check (returns **HTTP 404**, not TRPCError, since this is a REST route handler), rate limiting via `api` category, consistent JSON envelope, rate limit headers
- [ ] `apiError(code, message, status)` — builds error envelope
- [ ] All tests from 2.1 pass

---

### Task 2.3: API Response Schemas

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None
**Parallel with:** Phase 0, Phase 1

**Description:**
Create Zod schemas for API request/response with OpenAPI annotations.

**Acceptance Criteria:**

- [ ] `src/lib/api-schemas.ts` created
- [ ] Posting response schema, match response schema, pagination meta schema, error envelope schema
- [ ] OpenAPI annotations via `@asteasolutions/zod-to-openapi`
- [ ] `pnpm add @asteasolutions/zod-to-openapi` completed

---

### Task 2.4: REST Endpoint Tests

**Status:** 🔴 Blocked by 2.2, 2.3
**Effort:** 2h
**Dependencies:** Tasks 2.2, 2.3

**Description:**
Write integration tests for all REST endpoints. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/app/api/v1/__tests__/postings.test.ts` — list pagination, status filter, single posting, 404 for other employer's posting
- [ ] `src/app/api/v1/__tests__/matches.test.ts` — per-posting matches, all matches, PII redaction before mutual accept, PII included after accept, status filter
- [ ] Tests confirmed to FAIL

---

### Task 2.5: REST Endpoint Implementation

**Status:** 🔴 Blocked by 2.4
**Effort:** 2h
**Dependencies:** Task 2.4

**Description:**
Implement all 4 REST endpoints.

**Acceptance Criteria:**

- [ ] `src/app/api/v1/postings/route.ts` — GET with pagination, status filter
- [ ] `src/app/api/v1/postings/[id]/route.ts` — GET single posting, verifies ownership
- [ ] `src/app/api/v1/postings/[id]/matches/route.ts` — GET matches for posting, PII rules
- [ ] `src/app/api/v1/matches/route.ts` — GET all matches, PII rules
- [ ] All endpoints use `withApiResponse` wrapper
- [ ] All tests from 2.4 pass

---

## Phase 3: Webhooks & Events

### Task 3.1: Webhook Delivery Tests

**Status:** 🔴 Blocked by 0.1
**Effort:** 1.5h
**Dependencies:** Task 0.1
**Parallel with:** Phase 1, Phase 2

**Description:**
Write tests for webhook delivery Inngest function. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/server/inngest/functions/deliver-webhook.test.ts` written
- [ ] Tests cover: HMAC-SHA256 signature computation, fan-out to matching subscriptions, event type filtering, delivery recording (success/failure), retry behavior, 10s timeout, redirect following
- [ ] Tests confirmed to FAIL

---

### Task 3.2: Webhook Delivery Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5h
**Dependencies:** Task 3.1

**Description:**
Implement Inngest function for webhook delivery.

**Acceptance Criteria:**

- [ ] `src/server/inngest/functions/deliver-webhook.ts` created
- [ ] Triggered by `api/webhook.deliver` event
- [ ] Queries active WebhookSubscription rows for employer + event type
- [ ] Computes HMAC-SHA256 signature with `X-Webhook-Signature` header
- [ ] Records WebhookDelivery row (payload, status, response)
- [ ] Retry config: 4 attempts with 1m, 5m, 30m backoff
- [ ] 10s HTTP timeout, follows up to 3 redirects
- [ ] Registered in `src/server/inngest/functions/index.ts`
- [ ] All tests from 3.1 pass

---

### Task 3.3: Webhook Event Emission

**Status:** 🔴 Blocked by 3.2
**Effort:** 0.5h
**Dependencies:** Task 3.2

**Description:**
Emit webhook events from match mutation code paths.

**Acceptance Criteria:**

- [ ] `run-agent-conversation.ts` emits `api/webhook.deliver` with `eventType: "match.created"` after match creation
- [ ] `matches.ts` router emits `api/webhook.deliver` with `eventType: "match.accepted"` or `"match.declined"` on status change
- [ ] Events include `{ eventType, matchId, employerId }`

---

## Phase 4: OpenAPI Documentation

### Task 4.1: OpenAPI Validation Test

**Status:** 🔴 Blocked by 2.3
**Effort:** 0.5h
**Dependencies:** Task 2.3

**Description:**
Write OpenAPI validation tests. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] `src/app/api/v1/__tests__/openapi.test.ts` written
- [ ] Validates spec against OpenAPI 3.0 schema
- [ ] Verifies all endpoints documented
- [ ] Verifies auth scheme documented
- [ ] Tests confirmed to FAIL

---

### Task 4.2: OpenAPI Endpoint Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 1h
**Dependencies:** Task 4.1

**Description:**
Implement OpenAPI spec generation endpoint to pass tests.

**Acceptance Criteria:**

- [ ] `src/app/api/v1/openapi.json/route.ts` created
- [ ] Uses `@asteasolutions/zod-to-openapi` `OpenAPIRegistry`
- [ ] Registers all endpoint schemas with descriptions, examples
- [ ] Includes Bearer auth scheme documentation
- [ ] Includes rate limit information
- [ ] Returns valid OpenAPI 3.0 JSON
- [ ] All tests from 4.1 pass

---

## Phase 5: Quality Gates

### Task 5.1: Security Review — REST API

**Status:** 🔴 Blocked by 2.5, 3.3
**Effort:** 1h
**Dependencies:** Tasks 2.5, 3.3

**Description:**
Comprehensive security review of all API endpoints and webhook delivery.

**Acceptance Criteria:**

- [ ] Employer ID always derived from API key, never from request params
- [ ] No seeker PII exposed before mutual acceptance
- [ ] `crypto.timingSafeEqual` used for key comparison
- [ ] Webhook secrets never logged
- [ ] Rate limiting enforced correctly
- [ ] No injection vectors in query parameters

---

### Task 5.2: Component Tests

**Status:** 🔴 Blocked by 1.4
**Effort:** 1h
**Dependencies:** Task 1.4

**Description:**
Write tests for integrations UI components.

**Acceptance Criteria:**

- [ ] `tests/unit/components/integrations/api-key-manager.test.tsx` — create flow, list display, revoke action, copy button, max limit warning
- [ ] `tests/unit/components/integrations/webhook-manager.test.tsx` — create flow, event checkboxes, list, delete, test action

---

### Task 5.3: GDPR Cascade Update

**Status:** 🔴 Blocked by 0.1
**Effort:** 0.5h
**Dependencies:** Task 0.1
**Parallel with:** Phase 1-4

**Description:**
Update account deletion function to cascade-delete API keys and webhook data.

**Acceptance Criteria:**

- [ ] `execute-account-deletion.ts` updated to delete `ApiKey`, `WebhookSubscription`, `WebhookDelivery` records
- [ ] Existing account deletion tests updated

---

### Task 5.4: Code Review

**Status:** 🔴 Blocked by 5.1, 5.2, 5.3
**Effort:** 0.5h
**Dependencies:** Tasks 5.1, 5.2, 5.3

**Description:**
Run `/code-review` on all new and modified files.

**Acceptance Criteria:**

- [ ] All CRITICAL and HIGH issues resolved
- [ ] TypeScript compilation passes with zero errors

---

### Task 5.5: Full Test Suite Validation

**Status:** 🔴 Blocked by 5.4
**Effort:** 0.25h
**Dependencies:** Task 5.4

**Description:**
Run full test suite to verify no regressions.

**Acceptance Criteria:**

- [ ] All existing tests still pass
- [ ] New test coverage >= 80% for feature code

---

### Task 5.6: Dashboard Navigation Link

**Status:** 🔴 Blocked by 1.4
**Effort:** 0.25h
**Dependencies:** Task 1.4

**Description:**
Add "Integrations" link to employer dashboard nav.

**Acceptance Criteria:**

- [ ] Link added to dashboard navigation
- [ ] Conditionally rendered when `PUBLIC_API` flag enabled
- [ ] Links to `/dashboard/integrations`

---

## Dependency Graph

```
0.1 (schema) ──────────┬──────────────┬──────────────────┐
0.2 (flags)            │              │                  │
0.3 (key tests) → 0.4 (key impl)     │                  │
                       │              │                  │
                  1.1 (integ tests)   3.1 (wh tests)    5.3 (GDPR)
                       ↓              ↓
                  1.2 (integ impl)   3.2 (wh impl)
                       ↓              ↓
                  1.3 (register)     3.3 (emissions)
                       ↓
                  1.4 (UI) → 5.2 (comp tests) → 5.6 (nav link)

2.3 (schemas) ─────────┐
0.2 (flags) ───────┐   │
                   ↓   ↓
2.1 (mw tests) → 2.2 (mw impl) → 2.4 (endpoint tests) → 2.5 (endpoints)
                                        ↓
                                   4.1 (openapi test) → 4.2 (openapi impl)

2.5 + 3.3 → 5.1 (security) ─┐
5.2 + 5.3 ──────────────────→ 5.4 (review) → 5.5 (validation)
1.5 (security - keys)
```

**Critical Path:** 0.1 → 0.4 → 1.1 → 1.2 → 1.3 → 1.4 → 5.2 → 5.4 → 5.5
**Parallel opportunities:** 0.1/0.2/0.3 all start immediately; 2.3 independent; 3.1-3.3 parallel with Phase 1-2; 5.3 parallel with all
