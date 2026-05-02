# Feature: API-Only Pivot

**Branch:** api-only-pivot
**Date:** 2026-04-30
**Status:** Approved
**Priority:** P0 — architectural direction change
**Supersedes:** Feature 28 spec (API surface detail); UI of Features 3, 4, 6, 9, 12, 13, 14, 15, 17, 18, 19–22, 27
**Scope expansion note:** Feature 28 spec resolved API scope as employer-only. This pivot intentionally expands to both seekers and employers from the outset, superseding that decision.

---

## Overview

JobBobber pivots from a full-stack Next.js SaaS application to an API-first,
agent-focused platform. The product surface reduces to a marketing landing page,
a registration/checkout funnel, and a documented REST API. The platform's core
value — autonomous AI agent matching — is exposed programmatically so external
agents and integrations can drive the hiring workflow without any manual UI
interaction.

---

## User Stories

### US-1: Developer API Access

**As a** developer building an agent integration
**I want** to authenticate to JobBobber with a long-lived API key
**So that** my agent can access matches, postings, and conversations programmatically

**Acceptance Criteria:**

- [ ] Developer can create an API key from the registration portal
- [ ] Key is displayed exactly once at creation (not retrievable afterward)
- [ ] Key authenticates via `Authorization: Bearer jb_live_*` header
- [ ] Key is scoped to the owner (seeker or employer) — cannot access other users' data
- [ ] Developer can list all active keys (masked prefix only)
- [ ] Developer can revoke a key, immediately invalidating it
- [ ] Maximum 10 active keys per account

---

### US-2: Webhook Event Subscriptions

**As a** developer building an agent integration
**I want** to register a webhook URL to receive real-time events
**So that** my agent can react to match results and conversation outcomes without polling

**Acceptance Criteria:**

- [ ] Developer can subscribe an HTTPS URL to one or more event types
- [ ] Supported events: `match.created`, `match.accepted`, `match.declined`, `conversation.completed`, `subscription.changed`
- [ ] Each webhook delivery includes an HMAC-SHA256 signature for verification
- [ ] Failed deliveries are retried automatically (Inngest handles retry)
- [ ] Developer can list, test, and delete webhook subscriptions
- [ ] Maximum 5 active webhook subscriptions per account

---

### US-3: Programmatic Platform Access

**As a** developer
**I want** to read and manage JobBobber resources (postings, matches, conversations, profile, insights) via REST
**So that** I can build fully automated hiring workflows without any UI interaction

**Acceptance Criteria:**

- [ ] All core platform resources accessible via `GET /api/v1/*` endpoints
- [ ] Paginated list endpoints use cursor-based pagination
- [ ] Match accept/decline available via `POST /api/v1/matches/:id/accept|decline`
- [ ] Profile updates available via `PATCH /api/v1/profile`
- [ ] Private negotiation parameters never exposed in any API response
- [ ] Seeker PII absent from match responses until mutual acceptance

---

### US-4: API Documentation

**As a** developer
**I want** always-current, interactive API documentation
**So that** I can understand endpoints, schemas, and test calls without reading source code

**Acceptance Criteria:**

- [ ] OpenAPI 3.0 spec available at `/api/v1/openapi.json`
- [ ] Interactive docs UI accessible at `/docs`
- [ ] Spec importable into Postman/Insomnia without errors
- [ ] Each endpoint documents: auth, parameters, request body, response schema, error codes

---

### US-5: Registration and Onboarding

**As a** new user
**I want** a clear path from landing page to receiving my API key
**So that** I can start integrating JobBobber in one session

**Acceptance Criteria:**

- [ ] Landing page communicates the product value proposition and links to sign-up
- [ ] Registration flow: sign-up → role selection → BYOK key setup → plan selection → API key issued
- [ ] API key issued on explicit user action (button click), not on page load
- [ ] API key displayed with copy-to-clipboard and "shown once" warning
- [ ] Authenticated users with completed onboarding directed to `/welcome` on first visit

---

## Non-Functional Requirements

### NFR-1: API response time

- `p95 < 200ms` for all read endpoints under normal load

### NFR-2: Rate limiting

- Free: 30 req/min; Pro: 300 req/min; Business: 1000 req/min
- 429 response with `Retry-After` header on limit exceeded
- Rate limiting must never fail open (Redis down → 429, not pass-through)

### NFR-3: Webhook delivery reliability

- Delivery success rate > 99% under normal conditions
- Retried automatically on failure; delivery audit log maintained

### NFR-4: Type safety

- All API request/response shapes validated via Zod (same schemas as internal tRPC layer)
- No `any` types in new code

### NFR-5: Test coverage

- 80%+ coverage on all new code (api-keys.ts, webhooks.ts, new routers, middleware changes)
- All existing 85 test files continue to pass throughout the pivot

---

## Edge Cases

- EC-1: Revoked key used → 401 with actionable message including revocation date
- EC-2: Rate limit exceeded → 429 with `Retry-After` header
- EC-3: Webhook URL unreachable → retry 3x with backoff; mark delivery failed, do not deactivate subscription
- EC-4: Match data accessed before mutual accept → seeker contact fields null/absent
- EC-5: 11th API key creation attempt → 422 with clear limit message
- EC-6: 6th webhook subscription attempt → 422 with clear limit message
- EC-7: User refreshes `/welcome` after key already created → show key management UI, not re-generate

---

## Feature Flag

Gated behind the `PUBLIC_API` Vercel feature flag. When disabled:

- All `/api/v1/` endpoints return 404
- API key management UI hidden from registration funnel

---

## Success Metrics

- At least 5 accounts create API keys within 30 days of `PUBLIC_API` flag full rollout
- API p95 response time < 200ms
- Webhook delivery success rate > 99%
- Zero unhandled 5xx errors on `/api/v1/` in first 7 days post-launch
