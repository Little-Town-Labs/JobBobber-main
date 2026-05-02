# Feature 28: Public REST API

**Branch:** 28-public-rest-api
**PRD Section:** Section 10 Technology Stack (API for Integrations)
**Priority:** P2
**Complexity:** Medium
**Status:** Planned
**Dependencies:** None (wraps existing tRPC procedures)

---

## Overview

External systems (ATS platforms, staffing agencies, internal tools) need programmatic
access to JobBobber data. This feature exposes a public REST API with its own API key
authentication, per-key rate limiting, auto-generated OpenAPI documentation, and
webhook subscriptions for real-time event notifications.

The API wraps existing platform capabilities — it does not introduce new business
logic. All data access respects existing RBAC rules scoped to the API key's owner.

**Business Value:** Enables enterprise customers to integrate JobBobber into their
existing hiring workflows, increasing platform stickiness and enabling ecosystem
partnerships with ATS vendors.

---

## User Stories

### User Story 1: API Key Management

**As an** employer
**I want** to create, view, and revoke API keys for my organization
**So that** I can securely grant external systems access to my JobBobber data

**Acceptance Criteria:**

- [ ] Employer can create a new API key with an optional descriptive label
- [ ] API key is displayed exactly once at creation time (not retrievable afterward)
- [ ] Employer can view a list of all active API keys showing label, created date, last used date, and a masked key prefix
- [ ] Employer can revoke any API key, immediately invalidating it
- [ ] Maximum of 10 active API keys per employer
- [ ] API keys are independent from BYOK keys (separate purpose and lifecycle)

**Priority:** High

### User Story 2: Read Job Postings via API

**As an** external system
**I want** to list and retrieve job postings for an employer
**So that** I can sync posting data into my ATS or reporting tool

**Acceptance Criteria:**

- [ ] `GET /api/v1/postings` returns paginated list of employer's postings
- [ ] `GET /api/v1/postings/:id` returns a single posting's full details
- [ ] Postings include: title, description, skills, experience level, employment type, location, salary range, status, created/updated dates
- [ ] Results filterable by status (ACTIVE, CLOSED, etc.)
- [ ] Pagination via cursor-based approach with configurable page size (max 100)
- [ ] Response format is JSON with consistent envelope structure

**Priority:** High

### User Story 3: Read Matches via API

**As an** external system
**I want** to retrieve match data for a specific posting or across all postings
**So that** I can track candidate pipeline status in my own system

**Acceptance Criteria:**

- [ ] `GET /api/v1/postings/:id/matches` returns matches for a specific posting
- [ ] `GET /api/v1/matches` returns all matches across employer's postings
- [ ] Match data includes: match ID, posting title, confidence score, seeker status, employer status, match summary, created date
- [ ] Results filterable by status (PENDING, ACCEPTED, DECLINED)
- [ ] No seeker PII (name, email, contact info) exposed until mutual acceptance
- [ ] After mutual accept, seeker's shared contact info is included

**Priority:** High

### User Story 4: Webhook Subscriptions

**As an** employer
**I want** to receive real-time notifications when matches are created, accepted, or declined
**So that** my external systems can react to pipeline changes without polling

**Acceptance Criteria:**

- [ ] Employer can subscribe a URL to receive webhook events
- [ ] Supported events: `match.created`, `match.accepted`, `match.declined`
- [ ] Webhook payload includes relevant match data (same as GET match response)
- [ ] Webhooks include a signature header for payload verification
- [ ] Failed deliveries are retried up to 3 times with exponential backoff
- [ ] Employer can list, test, and delete webhook subscriptions
- [ ] Maximum of 5 webhook subscriptions per employer

**Priority:** Medium

### User Story 5: API Documentation

**As a** developer integrating with JobBobber
**I want** auto-generated, always-current API documentation
**So that** I can understand available endpoints, request formats, and response schemas

**Acceptance Criteria:**

- [ ] OpenAPI 3.0 specification available at `/api/v1/openapi.json`
- [ ] Documentation reflects current API state (generated from source schemas)
- [ ] Each endpoint documents: request parameters, request body schema, response schema, error codes
- [ ] Authentication method documented (API key in header)
- [ ] Rate limit information documented per endpoint

**Priority:** Medium

### User Story 6: Rate Limiting

**As a** platform operator
**I want** API requests rate-limited per API key
**So that** no single integration can overwhelm the system

**Acceptance Criteria:**

- [ ] Each API key has a default rate limit (e.g., 100 requests per minute)
- [ ] Rate limit headers included in every response (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- [ ] Exceeding the limit returns HTTP 429 with a `Retry-After` header
- [ ] Rate limits are tracked per API key, independent of user session rate limits
- [ ] Webhook deliveries do not count against the API key's rate limit

**Priority:** High

---

## Functional Requirements

### FR-1: API Key Authentication

All API endpoints require a valid API key passed in the `Authorization` header as `Bearer <api-key>`. Invalid or revoked keys return HTTP 401.

### FR-2: Organization Scoping

API keys are scoped to an employer organization. All data access is limited to that organization's postings, matches, and settings. No cross-organization data access.

### FR-3: API Key Storage

API keys are stored as irreversible hashes. The raw key is shown exactly once at creation and cannot be retrieved afterward.

### FR-4: Consistent Response Format

All API responses use a consistent JSON envelope:

```
{
  "data": <payload>,
  "meta": { "total": N, "cursor": "...", "hasMore": true },
  "error": null
}
```

Error responses:

```
{
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "..." }
}
```

### FR-5: Webhook Signature Verification

Each webhook delivery includes an `X-Webhook-Signature` header containing an HMAC-SHA256 signature of the payload, computed using a per-subscription secret. The secret is shown once at subscription creation.

### FR-6: Webhook Retry Policy

Failed webhook deliveries (non-2xx response or timeout after 10 seconds) are retried at 1 minute, 5 minutes, and 30 minutes. After 3 failures, the delivery is marked as failed and the subscription is not deactivated (to avoid losing events during temporary outages).

### FR-7: OpenAPI Generation

The OpenAPI specification is generated from the same validation schemas used by the API endpoints, ensuring documentation is always in sync with implementation.

### FR-8: Versioned API Path

All endpoints are namespaced under `/api/v1/` to allow future breaking changes under `/api/v2/`.

---

## Non-Functional Requirements

### NFR-1: Performance

- API endpoint response time < 200ms (p95) for list operations
- API endpoint response time < 100ms (p95) for single-resource operations
- Webhook delivery latency < 30 seconds from event occurrence

### NFR-2: Security

- API keys stored as cryptographic hashes (not reversible)
- All endpoints served over HTTPS only
- No seeker PII exposed until mutual match acceptance
- API key operations require authenticated employer session (not API key auth)
- Webhook secrets stored encrypted at rest

### NFR-3: Reliability

- Webhook deliveries must be durable (survive server restarts)
- API key revocation takes effect immediately (no cache delay)
- Rate limit state must be consistent (no race conditions allowing burst over limit)

### NFR-4: Scalability

- API must handle 1000 requests per minute per employer without degradation
- Webhook delivery queue must handle 10,000 pending deliveries

### NFR-5: Usability

- OpenAPI spec must be valid and importable into Postman, Swagger UI, and similar tools
- Error messages must be actionable (e.g., "API key revoked on 2026-03-15" not "Unauthorized")

---

## Edge Cases & Error Handling

### EC-1: Revoked API Key Used

Return HTTP 401 with message indicating the key has been revoked.

### EC-2: Rate Limit Exceeded

Return HTTP 429 with `Retry-After` header indicating seconds until the limit resets.

### EC-3: Webhook Endpoint Unreachable

Retry 3 times with backoff. After exhausting retries, mark delivery as failed. Do not deactivate the subscription.

### EC-4: Webhook Endpoint Returns Redirect

Follow up to 3 redirects (301, 302, 307). Reject redirect loops.

### EC-5: API Key Limit Reached (10 keys)

Return HTTP 422 with message: "Maximum of 10 active API keys reached. Please revoke an existing key first."

### EC-6: Empty Posting List

Return empty `data` array with `meta.total: 0`. Do not return 404.

### EC-7: Match Data Before Mutual Accept

Return match metadata (ID, confidence, statuses, summary) but omit seeker contact info fields.

### EC-8: Webhook Subscription to Invalid URL

Validate URL format and reachability (HEAD request) at subscription time. Reject unreachable URLs.

### EC-9: Large CSV-style Bulk Fetch

Pagination is mandatory. Maximum page size is 100. No bulk download endpoint.

### EC-10: Concurrent API Key Revocation

If two team members revoke the same key simultaneously, both operations succeed idempotently.

---

## Success Metrics

- At least 5 employers create API keys within 30 days of launch
- Average API response time < 200ms (p95)
- Webhook delivery success rate > 99%
- OpenAPI spec validated by at least 2 external tools (Postman, Swagger)

---

## Feature Flag

This feature shall be gated behind a `PUBLIC_API` feature flag. When disabled, the API key management UI is hidden and all `/api/v1/` endpoints return HTTP 404.

---

## Clarifications

### Resolved Clarifications

1. **API access scope:** Employer-only. Seeker API can be added in a future iteration if demand exists.
2. **Write operations:** Read-only initially. Write operations can be added after validating usage patterns.
3. **Webhook event filtering:** Per-event subscription — employers subscribe to specific event types per subscription to reduce unnecessary traffic.
4. **UI placement:** API key management and webhook subscriptions live on a new `/dashboard/integrations` page, grouping all external integration concerns together.
