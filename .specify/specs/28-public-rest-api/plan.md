# Implementation Plan: Feature 28 — Public REST API

## Executive Summary

Expose a public, read-only REST API under `/api/v1/` for employer integrations (ATS platforms, staffing agencies). Own API key authentication (SHA-256 hashed, separate from Clerk/BYOK), per-key rate limiting via existing Upstash infrastructure, webhook subscriptions with Inngest-driven delivery and HMAC-SHA256 signatures, and auto-generated OpenAPI 3.0 documentation. UI at `/dashboard/integrations`. Feature gated behind `PUBLIC_API` flag.

## Architecture Overview

```
External System                    JobBobber Platform
─────────────                      ──────────────────

GET /api/v1/postings ──────►  ┌─────────────────────┐
Authorization: Bearer jb_...  │  API Middleware       │
                              │  ├─ Feature flag check │
                              │  ├─ Auth (hash lookup) │
                              │  ├─ Rate limit check   │
                              │  └─ Org scoping        │
                              └──────────┬────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │  Route Handler         │
                              │  (Prisma direct query) │
                              │  + Response mappers    │
                              └──────────┬────────────┘
                                         │
                              ┌──────────▼────────────┐
                              │  JSON Envelope         │
                              │  { data, meta, error } │
                              └───────────────────────┘

Match Events ──────►  ┌─────────────────────────┐
                      │  Inngest: deliver-webhook │
                      │  ├─ Find subscriptions    │
                      │  ├─ HMAC-SHA256 sign      │
                      │  ├─ HTTP POST             │
                      │  └─ Record delivery       │
                      └─────────────────────────┘

Employer Dashboard    ┌─────────────────────────┐
/dashboard/           │  /dashboard/integrations  │
integrations  ──────► │  ├─ API Key Manager       │
                      │  └─ Webhook Manager       │
                      └─────────────────────────┘
```

## Technology Decisions

### TD-1: API Key — SHA-256 Hash (Not bcrypt)

**Decision:** Generate 32-byte random keys (prefixed `jb_live_`), store SHA-256 hash only.

**Rationale:** API keys have 256 bits of entropy (unlike passwords), so preimage resistance of SHA-256 is sufficient. Fast lookup via indexed hash column. Use `crypto.timingSafeEqual` for comparison.

**Why not existing encryption.ts?** That provides reversible AES-256-GCM for BYOK keys that must be decrypted. API keys are never decrypted — one-way hashing is correct.

### TD-2: REST Routes Query Prisma Directly (Not tRPC)

**Decision:** Next.js App Router route handlers at `src/app/api/v1/`, querying Prisma directly.

**Rationale:** tRPC procedures are coupled to Clerk session auth (`ctx.userId`). REST API uses API key auth with no Clerk session. Shared response mapper functions avoid duplicating business logic. No awkward adapter layers.

### TD-3: Webhook Delivery via Inngest

**Decision:** Emit `api/webhook.deliver` Inngest events from match mutation paths. New Inngest function handles fan-out, signing, delivery, and retry.

**Rationale:** Inngest already handles all background work. Built-in retry with custom backoff (1m, 5m, 30m) reuses existing infrastructure. Deliveries survive server restarts.

### TD-4: OpenAPI from Zod via @asteasolutions/zod-to-openapi

**Decision:** Annotate Zod schemas with `.openapi()`, build OpenAPI doc programmatically at request time.

**Rationale:** No code generation, no YAML files to maintain. Spec computed from same schemas that validate requests — guarantees accuracy. Most mature option (7k+ GitHub stars).

### TD-5: Rate Limiting Reuses Existing Upstash

**Decision:** Add `api` category to `RATE_LIMIT_CATEGORIES` with 100 req/min, keyed by `apikey:<apiKeyId>`.

**Rationale:** Slots cleanly into existing infrastructure. No new dependencies. Fails open if Redis unavailable (existing behavior).

### TD-6: Employer ID From Key, Never From Input

**Decision:** All queries include `employerId` from the authenticated API key — never from user input.

**Rationale:** Cross-org access is structurally impossible. No endpoint accepts an `employerId` parameter.

## Implementation Phases

### Phase 0: Data Model & Infrastructure

0.1 Add `ApiKey`, `WebhookSubscription`, `WebhookDelivery` Prisma models + migration
0.2 Add `PUBLIC_API` feature flag
0.3 Add `api` rate limit category (100 req/min)
0.4 Create `src/lib/api-key.ts` — key generation, hashing, timing-safe comparison

### Phase 1: API Key Management (tRPC + UI)

1.1 Create `src/server/api/routers/integrations.ts` — API key + webhook CRUD
1.2 Register router in `root.ts`
1.3 Create `/dashboard/integrations/page.tsx`
1.4 Create `api-key-manager.tsx` component
1.5 Create `webhook-manager.tsx` component

### Phase 2: REST API Endpoints

2.1 Create `src/lib/api-middleware.ts` — auth, rate limiting, JSON envelope, feature flag gate
2.2 Create `src/lib/api-schemas.ts` — Zod schemas with OpenAPI annotations
2.3 `GET /api/v1/postings` — paginated posting list
2.4 `GET /api/v1/postings/:id` — single posting details
2.5 `GET /api/v1/postings/:id/matches` — matches for a posting
2.6 `GET /api/v1/matches` — all matches across employer's postings

### Phase 3: Webhooks & Events

3.1 Create `src/server/inngest/functions/deliver-webhook.ts`
3.2 Register function in Inngest index
3.3 Emit webhook events in `run-agent-conversation.ts` (match.created)
3.4 Emit webhook events in `matches.ts` router (match.accepted, match.declined)

### Phase 4: OpenAPI Documentation

4.1 `GET /api/v1/openapi.json` — generated from Zod schemas

### Phase 5: Testing

5.1 API key utility unit tests
5.2 API middleware unit tests (auth flow, rate limiting, flag gating)
5.3 REST endpoint integration tests (happy path, auth, pagination, PII redaction)
5.4 Integrations router tests (CRUD, limits)
5.5 Webhook delivery tests (signature, retry, recording)
5.6 OpenAPI spec validation test

## Security

- API keys stored as SHA-256 hashes (irreversible)
- `crypto.timingSafeEqual` prevents timing attacks
- Employer ID derived from key, never from request params
- Seeker PII hidden until mutual acceptance
- Webhook secrets encrypted at rest via existing `encrypt()`
- API key management requires Clerk session auth (not API key auth)
- Rate limiting prevents abuse (100 req/min per key)
- All endpoints return 404 when `PUBLIC_API` flag disabled

## Performance

- API endpoints: <200ms (p95) for list, <100ms for single resource
- Webhook delivery: <30s latency from event
- Rate limit: 100 req/min per key via Upstash sliding window

## Risks

| Risk                            | Severity | Mitigation                                         |
| ------------------------------- | -------- | -------------------------------------------------- |
| Cross-org data leak             | High     | Employer ID always from API key, never from params |
| Timing attack on key comparison | Medium   | `crypto.timingSafeEqual` on hash bytes             |
| Webhook overwhelming targets    | Medium   | 10s timeout, Inngest retry backoff                 |
| Webhook secret exposure in logs | Medium   | Encrypted at rest, shown once, never logged        |
| API key hash lookup at scale    | Low      | Unique index on `keyHash`, O(1) lookup             |

## Constitutional Compliance

- [x] Test-first imperative (TDD phases documented)
- [x] Simplicity enforced (reuses existing rate-limit, Inngest, encryption infra)
- [x] Security standards met (hashed keys, timing-safe comparison, org scoping)
- [x] Performance requirements addressed (<200ms API, <30s webhooks)
- [x] Feature flag gated (PUBLIC_API)
