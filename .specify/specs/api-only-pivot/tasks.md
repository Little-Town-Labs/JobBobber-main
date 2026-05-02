# Task Breakdown — API-Only Pivot

**Feature:** api-only-pivot
**Plan:** `.specify/specs/api-only-pivot/plan.md`
**Date:** 2026-04-30
**Status:** Ready for implementation

---

## Summary

- **Total Tasks:** 48
- **Phases:** 7 (Phase 0 → Phase 6)
- **Critical Path:** 0.0a → 0.1 → 0.2 → 0.6 → 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 2.6 → 2.7 → 2.8 → 4.1 → 4.2 → 4.4 → 5.3 → 5.4
- **Parallelization:** Phase 0 tasks run in parallel; Phase 1 router annotations run in parallel; Phase 1 and Task 1.4 (pgvector) parallel; Phases 5 and 6 partly parallel

---

## Phase 0 — Pre-Pivot Fixes

> Infrastructure prerequisites (0.0a, 0.0b) must be confirmed before implementation tasks begin.
> All implementation tasks (0.1–0.6) are independent and can run in parallel.

---

### Task 0.0a: Provision Upstash Redis in Vercel Marketplace

**Status:** 🟡 Ready (infrastructure action — human required)
**Blocks:** Task 0.2

**Description:**
Provision an Upstash Redis instance via the Vercel Marketplace integration.
Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` values into
Vercel environment variables (production + preview environments).

**Acceptance Criteria:**

- [ ] Upstash Redis instance created in Vercel Marketplace
- [ ] `UPSTASH_REDIS_REST_URL` set in Vercel env (production + preview)
- [ ] `UPSTASH_REDIS_REST_TOKEN` set in Vercel env (production + preview)
- [ ] Local `.env` updated for development

---

### Task 0.0b: Confirm Stripe Price IDs in Vercel environment

**Status:** 🟡 Ready (verification action — human required)
**Blocks:** Gate A

**Description:**
Verify that `STRIPE_PRICE_SEEKER_PRO` and `STRIPE_PRICE_EMPLOYER_BUSINESS` are
set to real Stripe Price IDs in all Vercel environments. Empty strings silently
break Stripe checkout at runtime with a confusing API error.

**Acceptance Criteria:**

- [ ] `STRIPE_PRICE_SEEKER_PRO` confirmed non-empty in production env
- [ ] `STRIPE_PRICE_EMPLOYER_BUSINESS` confirmed non-empty in production env
- [ ] Both IDs verified as valid in Stripe dashboard

---

### Task 0.1: Fix rate limiting — tests

**Status:** 🟡 Ready
**Parallel with:** 0.2, 0.3, 0.4

**Description:**
Write tests for the corrected `src/lib/rate-limit.ts` behavior before fixing it.

**Acceptance Criteria:**

- [ ] Test: missing Upstash env vars cause startup failure (not silent pass-through)
- [ ] Test: Redis connection error returns 429, not allows through
- [ ] Test: successful rate limit check returns `{ success: true }`
- [ ] Test: exceeded limit returns `{ success: false }` with correct `reset` timestamp
- [ ] All tests confirmed to **FAIL** against current implementation

---

### Task 0.2: Fix rate limiting — implementation

**Status:** 🔴 Blocked by 0.1
**Dependencies:** Task 0.1

**Description:**
Add `@upstash/ratelimit` and `@upstash/redis` to `package.json`. Add env vars to
`src/lib/env.ts`. Fix fail-open catch block to throw 429 and log to Sentry.

**Files:**

- `package.json`
- `src/lib/env.ts` — add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `src/lib/rate-limit.ts` — fix catch block
- Remove `types/upstash.d.ts` (phantom type stubs no longer needed)

**Acceptance Criteria:**

- [ ] All tests from 0.1 pass
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes (full suite)

---

### Task 0.3: Centralize env vars — tests

**Status:** 🟡 Ready
**Parallel with:** 0.1, 0.4

**Description:**
Write tests verifying that `src/lib/env.ts` validation catches all missing
environment variables at startup.

**Acceptance Criteria:**

- [ ] Test: each of the 10 missing vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `ENCRYPTION_KEY`, `ENCRYPTION_IV_SALT`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`,
      `CRON_SECRET`, `BLOB_STORE_HOSTNAME`, `STRIPE_PRICE_SEEKER_PRO`,
      `STRIPE_PRICE_EMPLOYER_BUSINESS`) causes a startup error when absent
- [ ] Test: `?? ""` fallback pattern no longer silently passes
- [ ] All tests confirmed to **FAIL** against current implementation

---

### Task 0.4: Centralize env vars — implementation

**Status:** 🔴 Blocked by 0.3
**Dependencies:** Task 0.3

**Description:**
Move all raw `process.env` accesses into the validated `src/lib/env.ts` schema.
Remove `?? ""` fallbacks.

**Files:**

- `src/lib/env.ts`
- `src/lib/stripe.ts`
- `src/lib/encryption.ts`
- `src/lib/billing-plans.ts`
- `src/lib/audit.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/server/api/routers/resume.ts`

**Acceptance Criteria:**

- [ ] All tests from 0.3 pass
- [ ] No `process.env[` accesses outside `env.ts` (grep confirms)
- [ ] `pnpm build` passes

---

### Task 0.5a: Remove deprecated stripe proxy export

**Status:** 🟡 Ready
**Parallel with:** 0.1, 0.3, 0.5b

**Description:**
Remove the `@deprecated` default export from `src/lib/stripe.ts` and update the
one callsite in `process-stripe-event.ts` to use `getStripe()` instead.

**Files:**

- `src/lib/stripe.ts`
- `src/server/inngest/functions/process-stripe-event.ts`

**Acceptance Criteria:**

- [ ] No references to the deprecated stripe export remain (`grep` confirms)
- [ ] `pnpm test` passes

---

### Task 0.5b: Drop deprecated `urls` field from JobSeeker

**Status:** 🟡 Ready
**Parallel with:** 0.1, 0.3, 0.5a

**Description:**
Write and run a Prisma migration dropping the deprecated `urls` column from
`JobSeeker`. Remove from any queries that still reference it.

**Files:**

- `prisma/schema.prisma`
- New Prisma migration: `drop-deprecated-job-seeker-urls`

**Acceptance Criteria:**

- [ ] `db:migrate:dev` runs without error
- [ ] No `urls` field references remain in queries or types
- [ ] `pnpm test` passes

---

### Task 0.6: Declare PUBLIC_API feature flag

**Status:** 🟡 Ready
**Parallel with:** 0.1, 0.3, 0.5a, 0.5b
**Blocks:** Task 1.1

**Description:**
Add the `PUBLIC_API` flag to `src/lib/flags.ts`. This flag gates all `/api/v1/`
endpoints and must exist before the REST handler is built in Phase 1.

**Files:**

- `src/lib/flags.ts` ✅ Already done (applied during analysis fixes)

**Acceptance Criteria:**

- [ ] `PUBLIC_API` exported from `src/lib/flags.ts`
- [ ] Flag defaults to `false`
- [ ] `pnpm type-check` passes

---

## Phase 1 — REST / OpenAPI Adapter

> Depends on Phase 0 complete. Router annotation tasks (1.3a–1.3g) run in parallel.

---

### Task 1.1: Install trpc-openapi + wire REST handler

**Status:** 🔴 Blocked by Phase 0 complete
**Dependencies:** 0.2, 0.4, 0.5a, 0.5b, 0.6

**Description:**
Install `trpc-openapi`. Create the catch-all REST route handler and the OpenAPI
spec route. Mount Scalar docs.

**Files (new):**

- `src/app/api/v1/[...path]/route.ts` — `createOpenApiNextHandler`
- `src/app/api/v1/openapi.json/route.ts` — serves generated spec
- `src/app/docs/page.tsx` — Scalar `ApiReference` component

**Acceptance Criteria:**

- [ ] `GET /api/v1/health` returns `{ status: "ok" }` (no auth required)
- [ ] `GET /api/v1/openapi.json` returns valid JSON
- [ ] `GET /docs` renders Scalar UI
- [ ] Existing `pnpm test` suite still passes (tRPC transport unchanged)

---

### Task 1.2: Integration test harness for REST endpoints

**Status:** 🔴 Blocked by 1.1
**Dependencies:** Task 1.1

**Description:**
Create a test helper that makes real HTTP requests to `/api/v1/` in the test
environment, so subsequent router annotation tasks have a working test pattern
to follow.

**Files (new):**

- `tests/helpers/rest-client.ts` — typed fetch wrapper for `/api/v1/`

**Acceptance Criteria:**

- [ ] Helper can make authenticated requests with `Authorization: Bearer` header
- [ ] Helper returns typed responses matching OpenAPI schemas
- [ ] One smoke test confirms health endpoint returns 200

---

### Task 1.3a: Annotate `health` + `jobPostings` routers

**Status:** 🔴 Blocked by 1.2
**Parallel with:** (run after 1.2; subsequent annotation tasks parallel with each other)

**Description:**
Add `openapi` metadata to `healthRouter` and `jobPostingsRouter` procedures.
Write integration tests verifying REST responses match `contracts/api-v1.yaml`.

**Files:**

- `src/server/api/routers/health.ts`
- `src/server/api/routers/jobPostings.ts`
- `tests/api/v1/postings.test.ts` (new)

**Acceptance Criteria:**

- [ ] `GET /api/v1/health` documented in spec
- [ ] `GET /api/v1/postings` returns paginated list with correct envelope
- [ ] `GET /api/v1/postings/:id` returns single posting or 404
- [ ] Status filter works (`?status=ACTIVE`)
- [ ] All integration tests pass

---

### Task 1.3b: Annotate `matches` router

**Status:** 🔴 Blocked by 1.2
**Parallel with:** 1.3a, 1.3c, 1.3d, 1.3e, 1.3f, 1.3g

**Files:**

- `src/server/api/routers/matches.ts`
- `tests/api/v1/matches.test.ts` (new)

**Acceptance Criteria:**

- [ ] `GET /api/v1/matches` — paginated, filterable by status and postingId
- [ ] `GET /api/v1/matches/:id` — seeker PII absent before mutual accept, present after
- [ ] `POST /api/v1/matches/:id/accept` — correct status transition
- [ ] `POST /api/v1/matches/:id/decline` — correct status transition
- [ ] All integration tests pass

---

### Task 1.3c: Annotate `conversations` + `insights` routers

**Status:** 🔴 Blocked by 1.2
**Parallel with:** 1.3a, 1.3b, 1.3d, 1.3e, 1.3f, 1.3g

**Files:**

- `src/server/api/routers/conversations.ts`
- `src/server/api/routers/insights.ts`
- `tests/api/v1/conversations.test.ts` (new)
- `tests/api/v1/insights.test.ts` (new)

**Acceptance Criteria:**

- [ ] `GET /api/v1/conversations` — paginated list
- [ ] `GET /api/v1/conversations/:id` — turn log with private params redacted
- [ ] `GET /api/v1/insights?days=30` — correct summary shape
- [ ] All integration tests pass

---

### Task 1.3d: Annotate `jobSeekers` + `employers` routers (profile)

**Status:** 🔴 Blocked by 1.2
**Parallel with:** 1.3a, 1.3b, 1.3c, 1.3e, 1.3f, 1.3g

**Files:**

- `src/server/api/routers/jobSeekers.ts`
- `src/server/api/routers/employers.ts`
- `tests/api/v1/profile.test.ts` (new)

**Acceptance Criteria:**

- [ ] `GET /api/v1/profile` — returns correct shape for both seeker and employer keys
- [ ] `PATCH /api/v1/profile` — partial update, returns updated profile
- [ ] All integration tests pass

---

### Task 1.3e: Annotate remaining routers (settings, notifications, custom-prompts, hiring-metrics, dashboard, compliance, billing, onboarding, byok, team, resume, chat)

**Status:** 🔴 Blocked by 1.2
**Parallel with:** 1.3a–1.3d, 1.3f, 1.3g

**Description:**
Annotate the remaining 11 routers with openapi metadata. These are lower priority
endpoints; mark any that are intentionally excluded from the public API surface
with `openapi: { enabled: false }`.

**Acceptance Criteria:**

- [ ] All 18 routers either annotated or explicitly excluded
- [ ] `GET /api/v1/openapi.json` spec validates with no missing paths
- [ ] `pnpm test` still passes

---

### Task 1.3f: Add `X-RateLimit-*` and `X-JobBobber-Request-Id` response headers

**Status:** 🔴 Blocked by 1.1
**Parallel with:** 1.3a–1.3e

**Description:**
Extend the REST route handler to inject `X-JobBobber-Request-Id` on every
response. Plumb rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset`) from the rate limiter into the response.

**Files:**

- `src/app/api/v1/[...path]/route.ts`

**Acceptance Criteria:**

- [ ] Every response includes `X-JobBobber-Request-Id` (UUID)
- [ ] Rate limit headers present on all authenticated responses
- [ ] Tests verify headers are set

---

### Task 1.3g: Validate OpenAPI spec against `contracts/api-v1.yaml`

**Status:** 🔴 Blocked by 1.3a–1.3e
**Dependencies:** All 1.3\* tasks

**Description:**
Run the generated `/api/v1/openapi.json` through an OpenAPI validator.
Confirm all paths in `contracts/api-v1.yaml` are present in the generated spec.

**Acceptance Criteria:**

- [ ] Generated spec passes `openapi-schema-validator` with no errors
- [ ] All paths from `contracts/api-v1.yaml` present in generated output
- [ ] Spec importable into Postman without errors

---

### Task 1.4: pgvector IVFFlat indexes migration

**Status:** 🔴 Blocked by Phase 0 complete
**Parallel with:** 1.1, 1.3a–1.3g

**Description:**
Write a raw SQL Prisma migration adding IVFFlat indexes to `profileEmbedding` and
`jobEmbedding` columns. These are required before the API goes live at any scale —
without them, all vector similarity searches are full table scans.

**Files:**

- New Prisma migration with raw SQL

**SQL:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_seeker_embedding
  ON "JobSeeker" USING ivfflat ("profileEmbedding" vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_posting_embedding
  ON "JobPosting" USING ivfflat ("jobEmbedding" vector_cosine_ops)
  WITH (lists = 100);
```

**Acceptance Criteria:**

- [ ] Migration runs on dev DB without error
- [ ] `EXPLAIN ANALYZE` on a vector similarity query shows index scan, not seq scan

---

## Phase 2 — API Key Authentication

> Depends on Phase 1 complete (specifically 1.1 for the middleware wiring).

---

### Task 2.1: Prisma migration — ApiKey model

**Status:** 🔴 Blocked by Phase 0 complete
**Parallel with:** 3.1 (webhook migration can be written simultaneously)

**Description:**
Write and run the Prisma migration adding `ApiKey` model and `OwnerType` enum.

**Files:**

- `prisma/schema.prisma` — add `ApiKey`, `OwnerType`
- New migration file

**Acceptance Criteria:**

- [ ] `pnpm db:migrate:dev` runs without error
- [ ] `pnpm generate` succeeds
- [ ] `ApiKey` table exists in dev DB with correct columns and indexes

---

### Task 2.2: `src/lib/api-keys.ts` — tests

**Status:** 🔴 Blocked by 2.1
**Dependencies:** Task 2.1

**Description:**
Write unit tests for the API key utility functions before implementing them.

**Acceptance Criteria:**

- [ ] Test: `generateApiKey()` returns `raw` starting with `jb_live_`
- [ ] Test: `generateApiKey()` raw key is 32+ bytes of entropy
- [ ] Test: `hashApiKey(raw)` returns consistent SHA-256 hex
- [ ] Test: `hashApiKey` of two different keys produces different hashes
- [ ] Test: `lookupApiKey(hash)` returns null for unknown hash
- [ ] Test: `lookupApiKey(hash)` returns null for revoked key
- [ ] All tests confirmed to **FAIL**

---

### Task 2.3: `src/lib/api-keys.ts` — implementation

**Status:** 🔴 Blocked by 2.2
**Dependencies:** Task 2.2

**Files (new):**

- `src/lib/api-keys.ts`

**Acceptance Criteria:**

- [ ] All tests from 2.2 pass
- [ ] `lastUsedAt` update is fire-and-forget (no `await`)
- [ ] `pnpm type-check` passes

---

### Task 2.4: `apiKeys` tRPC router — tests

**Status:** 🔴 Blocked by 2.3
**Dependencies:** Task 2.3

**Acceptance Criteria:**

- [ ] Test: `apiKeys.create` returns plaintext key + metadata
- [ ] Test: second call does NOT return the same plaintext (key not stored)
- [ ] Test: `apiKeys.list` returns only non-revoked keys for caller
- [ ] Test: `apiKeys.revoke` sets `revokedAt`, key then excluded from list
- [ ] Test: creating an 11th key returns an error (max 10 limit)
- [ ] All tests confirmed to **FAIL**

---

### Task 2.5: `apiKeys` router — implementation

**Status:** 🔴 Blocked by 2.4
**Dependencies:** Task 2.4

**Files (new):**

- `src/server/api/routers/apiKeys.ts`

Update:

- `src/server/api/root.ts` — register router

**Acceptance Criteria:**

- [ ] All tests from 2.4 pass
- [ ] OpenAPI metadata added so `/api/v1/keys` works
- [ ] `pnpm test` passes

---

### Task 2.6: API key middleware — tests

**Status:** 🔴 Blocked by 2.3
**Dependencies:** Task 2.3

**Description:**
Write integration tests for the middleware API key authentication path before
modifying `src/middleware.ts`.

**Acceptance Criteria:**

- [ ] Test: request with valid `Authorization: Bearer jb_live_*` succeeds
- [ ] Test: request with revoked key returns 401 with actionable message
- [ ] Test: request with malformed key returns 401
- [ ] Test: request with no bearer header falls through to Clerk session auth
- [ ] Test: seeker key cannot access employer-scoped endpoints
- [ ] All tests confirmed to **FAIL**

---

### Task 2.7: API key middleware — implementation

**Status:** 🔴 Blocked by 2.6
**Dependencies:** Task 2.6

**Files:**

- `src/middleware.ts` — add bearer token pre-check
- `src/server/api/trpc.ts` — extend `createTRPCContext` to accept resolved owner

**Acceptance Criteria:**

- [ ] All tests from 2.6 pass
- [ ] Existing Clerk session auth still works (web registration funnel unaffected)
- [ ] `pnpm test` full suite passes

---

### Task 2.8: Security review — API key system

**Status:** 🔴 Blocked by 2.7
**Dependencies:** Task 2.7

**Description:**
Run `/security-review` on `src/lib/api-keys.ts` and `src/middleware.ts`.

**Acceptance Criteria:**

- [ ] No CRITICAL or HIGH issues unresolved
- [ ] `Authorization` header confirmed never logged or sent to Sentry
- [ ] Key format confirmed not confusable with BYOK keys in any log output
- [ ] SSRF not possible via API key lookup (hash lookup only, no URL fetching)

---

## Phase 3 — Webhook System

> Phase 3 can start as soon as Phase 2.1 is done (migrations). Full integration
> tests need Phase 2 middleware complete.

---

### Task 3.1: Prisma migration — Webhook + WebhookDelivery models

**Status:** 🔴 Blocked by Phase 0 complete
**Parallel with:** 2.1

**Files:**

- `prisma/schema.prisma` — add `Webhook`, `WebhookDelivery`, `WebhookEvent` enum
- New migration file

**Acceptance Criteria:**

- [ ] `pnpm db:migrate:dev` runs without error
- [ ] Both tables exist in dev DB with correct columns and indexes

---

### Task 3.2: `src/lib/webhooks.ts` — tests

**Status:** 🔴 Blocked by 3.1
**Dependencies:** Task 3.1

**Acceptance Criteria:**

- [ ] Test: `generateWebhookSecret()` returns 64-char hex string
- [ ] Test: `signPayload(payload, secret)` produces consistent HMAC-SHA256
- [ ] Test: different secrets produce different signatures for same payload
- [ ] Test: `deliverWebhook` POSTs to correct URL with `X-JobBobber-Signature` header
- [ ] Test: `deliverWebhook` returns `{ success: false }` on HTTP error
- [ ] Test: `deliverWebhook` writes a `WebhookDelivery` record regardless of outcome
- [ ] All tests confirmed to **FAIL**

---

### Task 3.3: `src/lib/webhooks.ts` — implementation

**Status:** 🔴 Blocked by 3.2
**Dependencies:** Task 3.2

**Files (new):**

- `src/lib/webhooks.ts`

**Acceptance Criteria:**

- [ ] All tests from 3.2 pass
- [ ] Webhook secret stored encrypted via `src/lib/encryption.ts`
- [ ] Private IP ranges (RFC 1918) rejected at URL validation time
- [ ] `pnpm type-check` passes

---

### Task 3.4: `webhooks` tRPC router — tests

**Status:** 🔴 Blocked by 3.3
**Dependencies:** Task 3.3

**Acceptance Criteria:**

- [ ] Test: `webhooks.create` validates URL is HTTPS
- [ ] Test: `webhooks.create` rejects private IP addresses
- [ ] Test: `webhooks.create` returns secret once only
- [ ] Test: creating a 6th webhook returns error (max 5)
- [ ] Test: `webhooks.list` returns only active webhooks for caller
- [ ] Test: `webhooks.delete` sets `active: false`
- [ ] Test: `webhooks.test` dispatches a test event payload
- [ ] All tests confirmed to **FAIL**

---

### Task 3.5: `webhooks` router — implementation

**Status:** 🔴 Blocked by 3.4
**Dependencies:** Task 3.4

**Files (new):**

- `src/server/api/routers/webhooks.ts`

Update:

- `src/server/api/root.ts`

**Acceptance Criteria:**

- [ ] All tests from 3.4 pass
- [ ] OpenAPI metadata added for `/api/v1/webhooks` endpoints
- [ ] `pnpm test` passes

---

### Task 3.6: Integrate webhook dispatch into Inngest functions — tests

**Status:** 🔴 Blocked by 3.3
**Dependencies:** Task 3.3

**Description:**
Write tests confirming webhook delivery is triggered by match events, conversation
completion, and subscription changes.

**Acceptance Criteria:**

- [ ] Test: `match.created` event triggers webhook POST to registered subscriber
- [ ] Test: `match.accepted` → `MUTUAL_ACCEPT` triggers webhook
- [ ] Test: `conversation.completed` triggers webhook
- [ ] Test: no webhook fired if no active subscriptions exist
- [ ] All tests confirmed to **FAIL** against current Inngest functions

---

### Task 3.7: Integrate webhook dispatch — implementation

**Status:** 🔴 Blocked by 3.6
**Dependencies:** Task 3.6

**Files:**

- `src/server/inngest/functions/send-match-notification.ts` — add `post-webhooks` step
- `src/server/inngest/functions/run-agent-conversation.ts` — add `conversation.completed` dispatch
- `src/server/inngest/functions/process-stripe-event.ts` — add `subscription.changed` dispatch

**Acceptance Criteria:**

- [ ] All tests from 3.6 pass
- [ ] Webhook delivery is always async (never blocks the calling request)
- [ ] `WebhookDelivery` records created for every attempt
- [ ] `pnpm test` passes

---

### Task 3.8: Security review — webhook system

**Status:** 🔴 Blocked by 3.5, 3.7
**Dependencies:** Task 3.5, 3.7

**Description:**
Run `/security-review` on `src/lib/webhooks.ts` and the `webhooks` router.

**Acceptance Criteria:**

- [ ] SSRF mitigations verified (private IP blocklist, HTTPS enforcement)
- [ ] HMAC signing confirmed on all outbound payloads
- [ ] Webhook secrets confirmed never returned after creation
- [ ] No CRITICAL or HIGH issues unresolved

---

## Phase 4 — Cut the UI

> Depends on Phases 1–3 complete and all tests passing. Deletions done in batches
> with build verification after each batch.

---

### Task 4.1: Delete seeker + employer route groups

**Status:** 🔴 Blocked by Phase 3 complete
**Dependencies:** Phase 3 all tasks

**Description:**
Delete `src/app/(seeker)/`, `src/app/(employer)/`, and `src/app/account/`.

**Acceptance Criteria:**

- [ ] Directories deleted
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (no test files reference deleted pages)

---

### Task 4.2: Delete UI component directories

**Status:** 🔴 Blocked by 4.1
**Dependencies:** Task 4.1

**Description:**
Delete UI component directories listed in the plan. Preserve `streaming-parser.ts`
from `src/components/chat/`.

**Directories to delete:**
`chat/` (except `streaming-parser.ts`), `conversations/`, `dashboard/`,
`employer/`, `matches/`, `profile/`, `settings/`, `team/`, `insights/`, `compliance/`

**Acceptance Criteria:**

- [ ] All listed directories deleted
- [ ] `src/components/chat/streaming-parser.ts` still exists
- [ ] `pnpm build` passes

---

### Task 4.3: Remove UI-only npm dependencies

**Status:** 🔴 Blocked by 4.2
**Dependencies:** Task 4.2

**Description:**
Remove `recharts`, `@tanstack/react-query`, `@trpc/client`, `@trpc/react-query`
from `package.json`. Delete `src/lib/trpc/client.tsx` and `src/lib/trpc/hooks.ts`.

**Acceptance Criteria:**

- [ ] `pnpm install` after removal has no peer dep warnings for these packages
- [ ] `pnpm build` passes
- [ ] Bundle size reduced (confirm with `pnpm build` output)

---

### Task 4.4: Update middleware routing

**Status:** 🔴 Blocked by 4.2
**Dependencies:** Task 4.2

**Description:**
Update `src/middleware.ts` to remove all redirects to deleted routes.
New routing: unauthenticated → `/`; authenticated without role → `/onboarding/role`;
authenticated with role → `/welcome`.

**Acceptance Criteria:**

- [ ] Middleware unit tests updated to reflect new routing
- [ ] No references to `(seeker)` or `(employer)` routes remain
- [ ] `pnpm test` passes

---

## Phase 5 — Landing Page + Registration Funnel

> Phases 5 and 6 are independent of each other and can run in parallel.

---

### Task 5.1: E2E test for registration funnel — tests first

**Status:** 🔴 Blocked by Phase 4 complete
**Parallel with:** 5.2, 6.1, 6.2

**Description:**
Write Playwright E2E test for the complete registration funnel before building it.

**Files (new):**

- `tests/e2e/registration-funnel.spec.ts`

**Acceptance Criteria:**

- [ ] E2E test: landing page loads, hero visible, CTA links to `/sign-up`
- [ ] E2E test: sign-up → role selection → BYOK setup → checkout → `/welcome` navigates correctly
- [ ] E2E test: `/welcome` displays masked API key with copy button
- [ ] All tests confirmed to **FAIL**

---

### Task 5.2: Build landing page

**Status:** 🔴 Blocked by Phase 4 complete
**Parallel with:** 5.1, 6.1, 6.2

**Description:**
Replace `src/app/page.tsx` with a real marketing landing page.

**Sections:** Hero + CTA, How it works (3 steps), Pricing (embed `pricing-table.tsx`),
Developer section (API code snippet + link to `/docs`), Footer.

**Files:**

- `src/app/page.tsx` — full replacement
- New component files as needed under `src/components/marketing/`

**Acceptance Criteria:**

- [ ] Page renders with correct sections
- [ ] "Get started free" CTA links to `/sign-up`
- [ ] Pricing table renders
- [ ] API code snippet visible in developer section
- [ ] Page is statically generated (no `"use client"` on root page)

---

### Task 5.3: Build `/welcome` page

**Status:** 🔴 Blocked by 2.5 (apiKeys router), 4.4 (middleware)
**Dependencies:** Task 2.5, 4.4

**Description:**
Create `/welcome` page. The first API key is created on **explicit user action**
(button click), not on page load — page-load mutation would burn a key slot on
every refresh and leave the user with an inaccessible key on subsequent visits.

**Files (new):**

- `src/app/(onboarding)/welcome/page.tsx`

**Acceptance Criteria:**

- [ ] Page renders a "Generate your API key" button (not auto-triggered on load)
- [ ] Button click triggers `apiKeys.create` server action; raw key returned and displayed once
- [ ] Raw key shown in masked input with copy-to-clipboard button
- [ ] Warning: "This key will not be shown again" visible alongside the key
- [ ] Link to `/docs` prominently placed
- [ ] Revisiting page after key already created shows key management list (masked prefix), not re-generate button

---

### Task 5.4: Wire and verify full registration funnel

**Status:** 🔴 Blocked by 5.2, 5.3
**Dependencies:** Task 5.2, 5.3

**Description:**
Confirm all existing onboarding pages connect into a working funnel end-to-end.

**Funnel:** `/sign-up` → `/onboarding/role` → `/setup/api-key` → Stripe checkout → `/welcome`

**Acceptance Criteria:**

- [ ] E2E tests from 5.1 pass
- [ ] Middleware correctly routes through each step with no dead ends
- [ ] Stripe test mode checkout completes successfully

---

## Phase 6 — Developer Experience

---

### Task 6.1: Quickstart guide page

**Status:** 🔴 Blocked by Phase 1 complete (Scalar mounted)
**Parallel with:** 5.1, 5.2, 6.2

**Files (new):**

- `src/app/docs/quickstart/page.tsx`

**Content:**

- Authentication (show `Authorization: Bearer` header example)
- First API call (curl example for `GET /api/v1/health`)
- Listing matches (curl example)
- Webhook setup (curl example for creating a subscription)
- Link to full Scalar reference

**Acceptance Criteria:**

- [ ] Page renders and is statically generated
- [ ] All curl examples are valid against the live API spec
- [ ] Link from `/docs` to `/docs/quickstart` works

---

### Task 6.2: Consistent error envelope + content-type on REST layer

**Status:** 🔴 Blocked by Phase 1 complete
**Parallel with:** 5.1, 5.2, 6.1

**Description:**
Ensure every 4xx and 5xx from `/api/v1/` returns `Content-Type: application/json`
and the standard error envelope `{ error: { code, message } }`.

**Files:**

- `src/app/api/v1/[...path]/route.ts` — error handler

**Acceptance Criteria:**

- [ ] Integration test: 401 response has correct Content-Type and envelope
- [ ] Integration test: 404 response has correct Content-Type and envelope
- [ ] Integration test: 422 response has correct Content-Type and envelope
- [ ] Integration test: 429 response includes `Retry-After` header

---

### Task 6.3: Constitution amendments

**Status:** 🟡 Ready — start immediately, run in parallel with implementation
**Parallel with:** Phase 1 tasks

**Description:**
Update `.specify/memory/constitution.md` with two minor amendments documented
in `plan.md`:

1. Update Article I data flow chain to include REST/OpenAPI path
2. Update Technology Stack section to clarify tRPC as internal-only; REST/OpenAPI as external contract

**Acceptance Criteria:**

- [ ] Constitution version bumped to 1.0.1 (patch)
- [ ] Amendment rationale documented inline
- [ ] Committed separately with `docs: amend constitution to v1.0.1`

---

## Quality Gates

### Gate A: Phase 0 → Phase 1

- [ ] `pnpm test` passes (full suite, no skips)
- [ ] `pnpm build` passes
- [ ] Task 0.0a complete: Upstash Redis provisioned and env vars set
- [ ] Task 0.0b complete: Stripe Price IDs confirmed non-empty in Vercel env
- [ ] Task 0.6 complete: `PUBLIC_API` flag declared in `src/lib/flags.ts`

### Gate B: Phase 2 complete (before Phase 4)

- [ ] API key auth integration tests pass end-to-end
- [ ] Security review 2.8 has no unresolved CRITICAL/HIGH issues
- [ ] `pnpm test` passes

### Gate C: Phase 3 complete (before Phase 4)

- [ ] Webhook delivery integration tests pass
- [ ] Security review 3.8 has no unresolved CRITICAL/HIGH issues
- [ ] `pnpm test` passes

### Gate D: Phase 4 complete (before Phase 5)

- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] No references to deleted routes in remaining code (grep confirms)
- [ ] Bundle size reduced from baseline

### Gate E: Phase 5 + 6 complete (before flag flip)

- [ ] Playwright E2E funnel test passes
- [ ] OpenAPI spec validates with external tool
- [ ] Scalar docs render and "Try it" runner works with a real API key
- [ ] `PUBLIC_API` flag enabled for internal team; no errors in Sentry for 24h

---

## Critical Path

```
0.1/0.3 → 0.2/0.4/0.5
                      → 1.1 → 1.2 → 1.3a–g (parallel)
                      → 2.1 → 2.2 → 2.3 → 2.4 → 2.5
                                              → 2.6 → 2.7 → 2.8
                      → 3.1 → 3.2 → 3.3 → 3.4 → 3.5
                                          → 3.6 → 3.7 → 3.8
                                                              → 4.1 → 4.2 → 4.3 → 4.4
                                                                                      → 5.1/5.3 → 5.4
                                                                                      → 5.2
                                                              → 6.1/6.2/6.3 (parallel with Phase 5)
```

Longest blocking chain: **0.1 → 0.2 → 2.1 → 2.2 → 2.3 → 2.6 → 2.7 → 2.8 → 4.1 → 4.2 → 4.4 → 5.3 → 5.4**
