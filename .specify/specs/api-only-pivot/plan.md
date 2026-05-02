# Implementation Plan — API-Only Pivot

**Feature:** api-only-pivot
**Date:** 2026-04-30
**Status:** Approved for implementation
**Constitution Version:** 1.0.0

---

## Executive Summary

JobBobber pivots from a full-stack Next.js SaaS application to an API-first,
agent-focused platform. The product surface shrinks to: (1) a marketing landing
page + registration/checkout funnel, and (2) a documented REST API that external
agents and integrations call programmatically.

~85% of the existing backend is preserved unchanged. ~120 UI files (~8,000 LOC)
are deleted. Three new backend capabilities are added: REST/OpenAPI adapter,
API key authentication, and webhook delivery.

**Key constraint:** All 85 existing test files must continue passing throughout
the pivot. No test may be deleted before the code it covers is also deleted.

---

## Architecture Overview

```
                 ┌──────────────────────────────────┐
                 │         Vercel (Edge + Fluid)     │
                 │                                  │
  Browser        │  /            Landing page (RSC) │
  (marketing) ──►│  /sign-up     Clerk hosted       │
                 │  /onboarding  Role + BYOK + Checkout
                 │                                  │
  Agents /       │  /api/v1/     REST adapter        │
  HTTP clients ─►│               (trpc-openapi)      │
                 │  /api/v1/     ──► tRPC routers    │
                 │  openapi.json      (18, unchanged) │
                 │  /docs        Scalar UI            │
                 │                                  │
                 │  /api/trpc    (internal, unchanged)│
                 │  /api/chat    AI SDK streaming     │
                 │  /api/inngest Inngest receiver     │
                 │  /api/webhooks/* Clerk + Stripe   │
                 └──────────────┬───────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         NeonDB/Prisma      Inngest           Vercel Blob
         (+ new models)     (+ webhook step)
              │
         pgvector (+ indexes)
```

---

## Technology Stack

| Concern          | Choice                                     | Rationale                                                     |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------- |
| REST adapter     | `trpc-openapi`                             | Preserves all tRPC routers and tests; zero rewrite risk       |
| API key auth     | Custom SHA-256 hashed keys                 | Simple, no new deps, fully testable, industry-standard        |
| Rate limiting    | `@upstash/ratelimit` + `@upstash/redis`    | Existing implementation is correct — just missing packages    |
| Webhook delivery | Inngest step inside notification functions | Reuses existing retry/backoff infrastructure                  |
| Docs UI          | `@scalar/nextjs-api-reference`             | Modern, lightweight, "Try it" runner built in                 |
| Landing page     | Next.js RSC (existing app)                 | Zero new infrastructure; Tailwind + shadcn/ui already present |

---

## Technical Decisions

See `research.md` for full options analysis. Summary:

| Decision         | Chosen                                                |
| ---------------- | ----------------------------------------------------- |
| REST strategy    | trpc-openapi adapter (not a rewrite)                  |
| API key auth     | Custom hashed keys, `Authorization: Bearer jb_live_*` |
| Webhook delivery | Inngest step (async, retried)                         |
| Rate limiting    | Add Upstash as proper package.json dependency         |
| Docs             | Scalar at `/docs`                                     |
| Landing page     | Next.js RSC within existing app                       |

---

## Data Model Changes

See `data-model.md` for full schema. Summary of additions:

- **`ApiKey`** — hashed programmatic access keys (max 10 per owner)
- **`Webhook`** — event subscriptions with HMAC signing (max 5 per owner)
- **`WebhookDelivery`** — delivery audit log for debugging
- **`OwnerType`** enum (SEEKER | EMPLOYER)
- **`WebhookEvent`** enum (MATCH_CREATED | MATCH_ACCEPTED | MATCH_DECLINED | CONVERSATION_COMPLETED | SUBSCRIPTION_CHANGED)
- Drop deprecated `urls` column from `JobSeeker`
- Add IVFFlat indexes for pgvector columns (raw SQL migration)

---

## API Surface

> **Scope note:** Feature 28 spec resolved API access as employer-only. This pivot
> intentionally expands scope to both seekers and employers from the outset,
> superseding that decision. Both `ApiKey` and `Webhook` models use an `OwnerType`
> enum (SEEKER | EMPLOYER) to support this.

See `contracts/api-v1.yaml` for the full OpenAPI spec. REST endpoints:

| Method    | Path                        | Description                         |
| --------- | --------------------------- | ----------------------------------- |
| GET       | /api/v1/health              | Health check (no auth)              |
| GET/POST  | /api/v1/keys                | List / create API keys              |
| DELETE    | /api/v1/keys/:id            | Revoke a key                        |
| GET/POST  | /api/v1/webhooks            | List / create webhook subscriptions |
| DELETE    | /api/v1/webhooks/:id        | Delete webhook                      |
| POST      | /api/v1/webhooks/:id/test   | Test delivery                       |
| GET       | /api/v1/postings            | List job postings                   |
| GET       | /api/v1/postings/:id        | Get posting                         |
| GET       | /api/v1/matches             | List matches                        |
| GET       | /api/v1/matches/:id         | Get match                           |
| POST      | /api/v1/matches/:id/accept  | Accept match                        |
| POST      | /api/v1/matches/:id/decline | Decline match                       |
| GET/PATCH | /api/v1/profile             | Get / update caller profile         |
| GET       | /api/v1/conversations       | List conversations                  |
| GET       | /api/v1/conversations/:id   | Get conversation detail             |
| GET       | /api/v1/insights            | Insights summary                    |
| GET       | /api/v1/openapi.json        | OpenAPI spec (no auth)              |

---

## Implementation Phases

### Phase 0: Pre-Pivot Fixes (blocking — do first)

These are defects that exist today regardless of the pivot. Fix them before
any other work so the baseline is clean.

**P0-1: Fix rate limiting phantom dependency**

- Add `@upstash/ratelimit` and `@upstash/redis` to `package.json`
- Provision Upstash Redis via Vercel Marketplace
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `src/lib/env.ts`
- Fix fail-open behavior: catch block must log to Sentry and return 429, not allow through
- Files: `src/lib/rate-limit.ts`, `src/lib/env.ts`, `package.json`

**P0-2: Move all `process.env` accesses into `env.ts`**

- Add to server schema: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ENCRYPTION_KEY`,
  `ENCRYPTION_IV_SALT`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `CRON_SECRET`,
  `BLOB_STORE_HOSTNAME`, `STRIPE_PRICE_SEEKER_PRO`, `STRIPE_PRICE_EMPLOYER_BUSINESS`
- Remove `?? ""` fallbacks — let the schema throw on missing vars at startup
- Files: `src/lib/env.ts`, `src/lib/stripe.ts`, `src/lib/encryption.ts`,
  `src/lib/billing-plans.ts`, `src/lib/rate-limit.ts`, `src/lib/audit.ts`,
  `src/app/api/webhooks/stripe/route.ts`, `src/server/api/routers/resume.ts`

**P0-3: Remove deprecated stripe proxy export**

- Delete the `@deprecated` default export from `src/lib/stripe.ts`
- Update `src/server/inngest/functions/process-stripe-event.ts` to use `getStripe()`
- Files: `src/lib/stripe.ts`, `src/server/inngest/functions/process-stripe-event.ts`

**P0-4: Drop deprecated `urls` field from JobSeeker**

- Write Prisma migration removing the column
- Remove from any queries that still reference it

---

### Phase 1: REST/OpenAPI Adapter

**Goal:** Add the `/api/v1/` REST surface without touching any existing router logic.

**Steps:**

1. Install `trpc-openapi`:

   ```
   pnpm add trpc-openapi
   ```

2. Create `/src/app/api/v1/[...path]/route.ts` — the REST handler that calls `createOpenApiNextHandler`

3. Create `/src/app/api/v1/openapi.json/route.ts` — serves the generated spec

4. Add `openapi` metadata to each of the 18 tRPC procedures, mapping them to the
   paths defined in `contracts/api-v1.yaml`. Priority order:
   - `health` router (trivial, proves the wiring)
   - `jobPostings` router (read endpoints)
   - `matches` router (read + accept/decline)
   - `conversations` router (read)
   - `insights` router (read)
   - `jobSeekers` + `employers` routers (profile read/update)
   - Remaining routers

5. Verify spec at `/api/v1/openapi.json` matches `contracts/api-v1.yaml` structure

6. Mount Scalar docs at `/docs` using `@scalar/nextjs-api-reference`

**Testing:**

- Unit: verify each annotated procedure's metadata compiles correctly
- Integration: HTTP requests against the REST handler return expected shapes
- All existing tRPC tests must continue passing (tRPC transport is unchanged)

---

### Phase 2: API Key Authentication

**Goal:** Allow requests with `Authorization: Bearer jb_live_*` to authenticate
without a browser session.

**Steps:**

1. Write Prisma migration: `ApiKey` model + `OwnerType` enum (see `data-model.md`)

2. Create `src/lib/api-keys.ts`:
   - `generateApiKey()` → returns `{ raw: string, hash: string, prefix: string }`
     using `crypto.randomBytes(32)` — format: `jb_live_<base64url>`
   - `hashApiKey(raw: string)` → SHA-256 hex
   - `lookupApiKey(hash: string)` → `ApiKey | null` from DB + update `lastUsedAt`

3. Create `src/server/api/routers/apiKeys.ts` — tRPC router for key management:
   - `apiKeys.list` → list caller's keys
   - `apiKeys.create` → generate + store; return plaintext once
   - `apiKeys.revoke` → set `revokedAt`

4. Add REST openapi metadata to `apiKeys` router so `/api/v1/keys` works

5. Extend `src/middleware.ts` to handle API key auth:
   - If `Authorization: Bearer jb_live_*` header is present: hash it, look up in DB,
     resolve owner, inject synthetic Clerk-compatible context
   - If no bearer header: fall through to existing Clerk session handling
   - This keeps Clerk auth working for the web registration flow unchanged

6. Extend `createTRPCContext` to accept the resolved owner from API key middleware

**Testing (TDD):**

- Write tests for `generateApiKey` and `hashApiKey` first
- Write tests for the `apiKeys` router (create, list, revoke, max-10 limit)
- Write integration test: HTTP request with `Authorization: Bearer <key>` returns
  correct data scoped to the key's owner

---

### Phase 3: Webhook System

**Goal:** Add programmatic event callbacks for agents subscribing to match events.

**Steps:**

1. Write Prisma migration: `Webhook`, `WebhookDelivery`, `WebhookEvent` enum

2. Create `src/lib/webhooks.ts`:
   - `generateWebhookSecret()` → random 32-byte hex
   - `signPayload(payload: string, secret: string)` → HMAC-SHA256 hex
   - `deliverWebhook(webhook, event, payload)` → HTTP POST with signature header
     `X-JobBobber-Signature: sha256=<hmac>`

3. Create `src/server/api/routers/webhooks.ts` — tRPC router:
   - `webhooks.list`, `webhooks.create`, `webhooks.delete`, `webhooks.test`
   - `create` validates URL reachability (HEAD request) before saving
   - Stores `secret` encrypted via existing `src/lib/encryption.ts`

4. Extend `src/server/inngest/functions/send-match-notification.ts`:
   - After each `sendEmail` step, add `step.run("post-webhooks", ...)` that:
     - Queries active webhooks for the owner subscribed to the event
     - Calls `deliverWebhook` for each
     - Writes a `WebhookDelivery` record (success or failure)
   - Inngest handles retries automatically for the step

5. Add similar webhook dispatch to:
   - `run-agent-conversation.ts` → `conversation.completed` event
   - `process-stripe-event.ts` → `subscription.changed` event

**Testing (TDD):**

- Write tests for `signPayload` (verify HMAC output)
- Write tests for `deliverWebhook` (mock HTTP client)
- Write tests for `webhooks` router (create, list, delete, max-5 limit, URL validation)
- Write tests verifying webhook delivery is triggered by match creation

---

### Phase 4: Cut the UI

**Goal:** Delete all authenticated app UI. What remains: landing page, auth pages,
onboarding funnel, billing/checkout.

**Steps:**

1. Delete route groups and their component directories:
   - `src/app/(seeker)/` — all seeker dashboard pages
   - `src/app/(employer)/` — all employer dashboard pages
   - `src/app/account/` — BYOK management page
   - `src/components/chat/` (except `streaming-parser.ts`)
   - `src/components/conversations/`
   - `src/components/dashboard/`
   - `src/components/employer/`
   - `src/components/matches/`
   - `src/components/profile/`
   - `src/components/settings/`
   - `src/components/team/`
   - `src/components/insights/`
   - `src/components/compliance/`

2. Remove UI-only dependencies from `package.json`:
   - `recharts` — charts used only in employer dashboard
   - `@tanstack/react-query` — only used via tRPC client hooks in app UI
   - tRPC client packages (`@trpc/client`, `@trpc/react-query`) — only needed for UI

3. Remove `src/lib/trpc/client.tsx` and `src/lib/trpc/hooks.ts`

4. Update `src/middleware.ts` — remove redirects to `/seeker/*` and `/employer/*`
   routes that no longer exist. Onboarding gate becomes: unauthenticated → landing
   page; authenticated without role → onboarding; authenticated with role → API key
   management page (the new "home" for authenticated users).

5. Verify build passes: `pnpm build`

**Approach:** Delete in order (route groups first, then components, then deps).
Run `pnpm build` after each deletion group to catch broken imports early rather
than discovering them all at once.

---

### Phase 5: Landing Page + Registration Funnel

**Goal:** Replace the 9-line placeholder with a real marketing page and wire the
existing onboarding pieces into a coherent purchase funnel.

**Landing page (`src/app/page.tsx`):**

- Hero: value proposition + "Get started free" CTA → `/sign-up`
- How it works: 3-step visual (Register → Configure agent → Matches arrive via API)
- Pricing: embed existing `pricing-table.tsx` component
- Developer-focused section: code snippet showing API usage, link to `/docs`
- Tech stack badges (OpenAI, Anthropic, pgvector, Inngest)
- Footer: links to docs, GitHub, status page

**Registration funnel (existing pieces, newly wired):**

```
/sign-up (Clerk)
  → /onboarding/role (pick SEEKER or EMPLOYER)
  → /setup/api-key (BYOK configuration — existing page)
  → /billing/checkout (Stripe Checkout — existing flow)
  → /welcome (new page: show API key + link to /docs)
```

The `/welcome` page is new: it triggers API key creation for the user
(first key auto-created on registration) and displays the raw key with
copy-to-clipboard. This is the only time the key is shown.

**Middleware update:**

- Authenticated users with completed onboarding → `/welcome` or `/docs`
- Remove all `/seeker/*` and `/employer/*` redirect paths

---

### Phase 6: Developer Experience

**Goal:** Make the API approachable for developers building agent integrations.

**Steps:**

1. Scalar docs already mounted at `/docs` (Phase 1 step 6)

2. Add a quickstart guide at `/docs/quickstart` (RSC page):
   - Install guide (curl / fetch examples)
   - First API call walkthrough
   - Webhook setup walkthrough
   - Link to full OpenAPI reference

3. Add `X-JobBobber-Request-Id` response header to all API responses (use
   `crypto.randomUUID()` in the REST handler) for support debugging

4. Ensure `Content-Type: application/json` and consistent error envelope on
   all `/api/v1/` 4xx and 5xx responses

---

## Security Considerations

| Risk                            | Mitigation                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| API key brute force             | Rate limiting on `/api/v1/` endpoints; 429 on limit exceeded                                 |
| Key exposure in logs            | Never log `Authorization` header; redact in Sentry                                           |
| Webhook SSRF                    | Validate URLs at creation time; block private IP ranges (RFC 1918)                           |
| Private params via API          | Existing tRPC `seekerProcedure`/`employerProcedure` auth scoping preserved                   |
| Seeker PII before mutual accept | `Match.seekerContact` field only populated after `MUTUAL_ACCEPT` status                      |
| Webhook secret theft            | Secrets encrypted at rest via existing AES-256-GCM encryption                                |
| Mass key generation             | Max 10 keys per owner enforced at router layer                                               |
| Replay attacks on webhooks      | Include `X-JobBobber-Timestamp` header; recommend clients reject events older than 5 minutes |

---

## Performance Strategy

| Concern                         | Approach                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| API key lookup on every request | SHA-256 hash indexed in DB; O(1) lookup                                                      |
| `lastUsedAt` update             | Fire-and-forget (`db.apiKey.update` without `await` in the auth path)                        |
| Employer middleware DB queries  | Existing 2-query pattern acceptable for Phase 1; cache in JWT claims as Phase 2 optimization |
| pgvector searches               | IVFFlat indexes added in Phase 0 migration                                                   |
| Webhook delivery latency        | Async via Inngest — never blocks the request path                                            |

---

## Testing Strategy

Each phase follows TDD: tests written before implementation.

| Phase | Test Type          | What to Cover                                                    |
| ----- | ------------------ | ---------------------------------------------------------------- |
| 0     | Unit               | `env.ts` validates correctly; rate limit throws on Redis down    |
| 1     | Integration        | Each REST endpoint returns correct shape; OpenAPI spec validates |
| 2     | Unit + Integration | Key generation, hashing, middleware auth bypass, max-10 limit    |
| 3     | Unit + Integration | HMAC signing, webhook delivery, retry on failure, max-5 limit    |
| 4     | Build verification | `pnpm build` passes; no broken imports                           |
| 5     | E2E (Playwright)   | Full funnel: sign-up → onboarding → checkout → API key displayed |
| 6     | Manual             | Scalar docs render; OpenAPI spec importable into Postman         |

Existing tests must remain green throughout. No test file is deleted until the
code it covers is also deleted (Phase 4).

---

## Deployment Strategy

The pivot does not require a new Vercel project. All changes deploy to the
existing project.

**Feature flag:** All `/api/v1/` endpoints are initially gated behind a
`PUBLIC_API` flag (already defined in Feature 28 spec). During the pivot:

1. Phases 0–3 deploy with flag OFF — REST layer exists but returns 404
2. Phase 4 (UI cut) deploys — existing authenticated users see a degraded UI
   (acceptable; this is a breaking change for the current user base)
3. Phase 5 deploys — new landing page goes live
4. Flag turned ON for internal team → beta users → full rollout

---

## Risks & Mitigation

| Risk                                          | Likelihood | Impact | Mitigation                                                                                    |
| --------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------- |
| trpc-openapi breaks existing router tests     | Low        | High   | Add adapter in a separate route file; existing tRPC handler at `/api/trpc/` is unchanged      |
| Middleware API key logic conflicts with Clerk | Medium     | High   | Implement as a pre-check before Clerk's `authMiddleware`; synthetic context passed downstream |
| Scalar OpenAPI rendering issues               | Low        | Low    | Fallback: serve raw JSON spec and link to editor.swagger.io                                   |
| Inngest webhook step exceeds function timeout | Low        | Medium | Webhook delivery is a `step.run` — Inngest handles timeout independently per step             |
| Phase 4 deletion breaks unseen import         | Medium     | Medium | Delete in small batches, run build after each                                                 |

---

## Constitutional Compliance

| Principle                | Status | Notes                                                    |
| ------------------------ | ------ | -------------------------------------------------------- |
| I. Type Safety           | ✅     | trpc-openapi preserves Zod types end-to-end              |
| II. TDD                  | ✅     | Each phase starts with test scaffolding                  |
| III. BYOK Architecture   | ✅     | Unchanged; API keys are separate from BYOK keys          |
| IV. Minimal Abstractions | ✅     | trpc-openapi is a thin adapter; no new heavy frameworks  |
| V. Security & Privacy    | ✅     | Private params scoped; seeker PII gated on mutual accept |
| VI. Phased Rollout       | ✅     | `PUBLIC_API` flag controls REST surface rollout          |
| VII. Agent Autonomy      | ✅     | Webhook callbacks enable agents to react without polling |

**Amendment Required:** Constitution Article I states "ALL data flows MUST be
type-safe: Database (Prisma) → API (tRPC) → UI (TypeScript)". The pivot adds a
new data flow path: `tRPC → REST (trpc-openapi) → External clients`. The Zod
schemas remain the source of truth, so type safety is preserved, but the
constitution's explicit chain reference to "UI (TypeScript)" should be updated to
include "REST API (OpenAPI/Zod)". Amendment is minor (patch version bump).

**Technology Stack (LOCKED) Amendment:** The frontend section lists "tRPC 11
(type-safe API)" as a locked frontend technology. With the UI pivot, tRPC becomes
an internal server technology only. The constitution should clarify that tRPC
remains for internal server-to-server use while REST/OpenAPI is the external
contract. Amendment needed.

---

## Next Steps

1. `/speckit-tasks` — generate ordered task breakdown for implementation
2. Review and merge constitution amendments (minor)
3. Provision Upstash Redis in Vercel Marketplace before Phase 0
4. Confirm Stripe Price IDs are set in Vercel environment variables
