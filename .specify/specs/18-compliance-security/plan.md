# Implementation Plan — Feature 18: Compliance & Security

## Executive Summary

Feature 18 adds regulatory compliance (GDPR/CCPA), security hardening (rate limiting, MFA encouragement), and audit infrastructure to JobBobber. The implementation builds on existing patterns — extending the audit log, adding a compliance tRPC router, introducing rate limiting middleware, and using Inngest for scheduled deletion. No new frameworks are introduced; the only new dependency is `@upstash/ratelimit` for serverless-compatible rate limiting.

## Architecture Overview

```
User Request
    │
    ▼
┌─────────────────────────────┐
│  Rate Limit Middleware       │  ← @upstash/ratelimit (Redis)
│  (tRPC middleware layer)     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  tRPC Router: compliance.*   │
│  - exportMyData              │
│  - requestDeletion           │  ← AuditLog (write)
│  - cancelDeletion            │
│  - getDeletionStatus         │
│  - getAuditLog (admin)       │
│  - getMfaStatus              │
│  - dismissMfaPrompt          │
└─────────────┬───────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌─────────┐
│ Prisma │ │Inngest │ │ Clerk   │
│  (DB)  │ │(async) │ │ (MFA)   │
└────────┘ └────────┘ └─────────┘
```

### New Components

1. **`src/server/api/routers/compliance.ts`** — tRPC router for GDPR/CCPA operations
2. **`src/lib/rate-limit.ts`** — Rate limiting utility using @upstash/ratelimit
3. **`src/lib/audit.ts`** — Platform-wide audit logging utility
4. **`src/server/inngest/functions/execute-account-deletion.ts`** — Scheduled deletion job
5. **`src/app/(seeker)/settings/compliance/page.tsx`** — Seeker compliance UI (export, deletion)
6. **`src/app/(employer)/settings/compliance/page.tsx`** — Employer compliance UI
7. **`src/components/compliance/mfa-prompt-banner.tsx`** — MFA encouragement banner

### Modified Components

1. **`prisma/schema.prisma`** — Add AuditLog, DeletionRequest models; change onDelete to Cascade
2. **`src/server/api/trpc.ts`** — Add rate limiting middleware
3. **`src/server/api/root.ts`** — Register compliance router
4. **`src/lib/flags.ts`** — Add COMPLIANCE_SECURITY feature flag
5. **`src/server/inngest/functions/index.ts`** — Register deletion function

## Technology Stack

All existing stack retained. One new dependency:

| Addition                | Purpose                  | Rationale                                                  |
| ----------------------- | ------------------------ | ---------------------------------------------------------- |
| `@upstash/ratelimit`    | Serverless rate limiting | Only viable option for Vercel serverless (see research.md) |
| Upstash Redis (service) | Rate limit state store   | Sub-5ms latency, serverless-native, sliding window         |

No other new dependencies. Clerk SDK (already installed) provides MFA status. Inngest (already installed) handles async deletion.

## Technical Decisions

### TD-1: Separate AuditLog Table

**Context:** Need platform-wide audit logging (seekers, employers, system) but existing ActivityLog is employer-scoped.
**Chosen:** New `AuditLog` model with `actorId` (Clerk user ID) and `actorType` enum.
**Rationale:** Clean separation of concerns. ActivityLog continues serving team activity; AuditLog serves compliance.
**Alternatives:** Extend ActivityLog (would require nullable employerId, breaking its invariant).

### TD-2: Synchronous Data Export

**Context:** GDPR requires data portability in machine-readable format.
**Chosen:** Synchronous tRPC query returning JSON.
**Rationale:** Most accounts have < 1000 matches. Prisma queries with `select` are efficient. 30s Vercel timeout sufficient.
**Alternatives:** Async Inngest job (over-engineering for current scale).

### TD-3: Inngest-Scheduled Deletion

**Context:** 72-hour grace period requires delayed execution.
**Chosen:** Inngest event with scheduled `ts` parameter.
**Rationale:** Already in stack, supports scheduling and retry. No new infrastructure.
**Alternatives:** Vercel Cron (less reliable, no retry), pg_cron (not available on NeonDB).

### TD-4: Cascade Delete Strategy

**Context:** AgentConversation and Match currently use `onDelete: Restrict`.
**Chosen:** Change to `onDelete: Cascade` for seeker/employer/jobPosting FKs.
**Rationale:** GDPR right-to-erasure requires full data removal. The deletion Inngest function terminates active conversations before deletion, so cascading is safe.
**Alternatives:** Application-level manual deletion (fragile, easy to miss new relations).

### TD-5: Rate Limiting as tRPC Middleware

**Context:** Need per-user and per-IP rate limits on all endpoints.
**Chosen:** tRPC middleware that runs before procedure execution.
**Rationale:** Centralized enforcement, no per-procedure boilerplate. Categories (auth/read/write/agent) assigned via procedure metadata or naming convention.
**Alternatives:** Per-procedure decorator (repetitive), Next.js middleware (limited tRPC integration).

## Implementation Phases

### Phase 1: Database & Infrastructure (Foundation)

1. Add `AuditLog` and `DeletionRequest` models to Prisma schema
2. Add new enums: `AuditActorType`, `AuditResult`, `DeletionUserType`, `DeletionStatus`
3. Change `onDelete: Restrict` → `onDelete: Cascade` on AgentConversation and Match FKs
4. Run `prisma generate` and create migration
5. Add `COMPLIANCE_SECURITY` feature flag
6. Install `@upstash/ratelimit` dependency
7. Create `src/lib/audit.ts` — platform-wide audit logging utility
8. Create `src/lib/rate-limit.ts` — rate limiting utility

### Phase 2: Core Backend (Data Export & Deletion)

1. Create `src/server/api/routers/compliance.ts` with:
   - `exportMyData` — JSON export of all user data
   - `requestDeletion` — initiate deletion with grace period
   - `cancelDeletion` — cancel during grace period
   - `getDeletionStatus` — check deletion request status
2. Create `src/server/inngest/functions/execute-account-deletion.ts`
3. Register compliance router in root.ts
4. Register deletion function in Inngest index

### Phase 3: Rate Limiting

1. Implement rate limiting middleware in `src/lib/rate-limit.ts`
2. Add middleware to tRPC stack in `src/server/api/trpc.ts`
3. Configure endpoint categories and limits
4. Add rate limit headers to responses
5. Handle 429 responses gracefully

### Phase 4: Audit & MFA

1. Add `getAuditLog` admin procedure to compliance router
2. Add `getMfaStatus` and `dismissMfaPrompt` procedures
3. Integrate audit logging calls into existing routers:
   - BYOK key rotation → audit
   - Settings changes → audit
   - Match status changes → audit
   - Subscription events → audit
4. Create IP hashing utility

### Phase 5: Frontend Integration

1. Create compliance settings pages (seeker and employer)
   - Data export button with download
   - Account deletion flow (two-step confirmation)
   - Deletion status display during grace period
2. Create MFA prompt banner component
3. Integrate MFA banner into layouts

### Phase 6: Bias Audit & Documentation

1. Create bias audit test suite for agent evaluation
2. Create bias audit checklist documentation
3. Create SOC 2 control mapping document
4. Store in `.specify/specs/18-compliance-security/docs/`

### Phase 7: Quality Validation

1. Run full test suite
2. Code review
3. Security review of all compliance-sensitive code
4. Verify 80%+ test coverage

## Security Considerations

### Data Export Security

- Export endpoint requires authentication (protected procedure)
- No cross-user data leakage — identity from ctx, not input
- API keys excluded from export (security-sensitive)
- Conversation messages redacted using existing `redaction.ts`

### Data Deletion Security

- Two-step confirmation required (exact phrase match)
- 72-hour grace period prevents accidental deletion
- Deletion logged before execution (audit trail preserved)
- Clerk account deletion included in cascade
- DeletionRequest record preserved after deletion (no personal data in it)

### Rate Limiting Security

- Per-user limits prevent authenticated abuse
- Per-IP limits protect unauthenticated endpoints
- IP hashing in logs avoids storing raw PII
- Fail-open design prevents rate limiter outage from blocking all traffic

### Audit Log Security

- Append-only at application level (no update/delete procedures)
- IP addresses hashed with SHA-256 + salt
- No sensitive data in metadata field (values, not keys; actions, not content)
- 2-year retention (configurable)

## Performance Strategy

### Rate Limiting: < 5ms

- Upstash Redis provides sub-5ms response times
- Sliding window algorithm is efficient
- Fail-open if Redis unavailable (no user impact)

### Data Export: < 30s

- Targeted Prisma queries with `select` (no `include *`)
- Stream-friendly JSON construction
- Conversation messages already stored as JSON (no joins needed)

### Audit Logging: Fire-and-forget

- Async logging (no await in request path)
- Matches existing `logActivity` pattern
- Batch writes if volume becomes a concern

### Deletion: Background

- Inngest handles heavy deletion work
- No user-facing latency (returns immediately after scheduling)
- Retry policy handles transient failures

## Testing Strategy

### Unit Tests

- `compliance.ts` router procedures (mock DB, mock Clerk)
- `rate-limit.ts` utility (mock Upstash)
- `audit.ts` utility (mock DB)
- `execute-account-deletion.ts` Inngest function (mock DB, mock Clerk)
- Data export completeness (verify all entities included)
- Deletion cascade correctness (verify no orphaned data)
- IP hashing determinism

### Integration Tests

- Rate limiting middleware (verify 429 responses)
- Audit log write + query round-trip
- Deletion request lifecycle (request → cancel, request → execute)

### Bias Audit Tests

- Identical profiles with different names produce equivalent match scores
- Agent prompts contain no discriminatory language
- Protected characteristics not used as proxy variables

## Deployment Strategy

1. Deploy schema migration (add AuditLog, DeletionRequest, change onDelete)
2. Deploy code with `COMPLIANCE_SECURITY` flag OFF
3. Configure Upstash Redis environment variables
4. Enable flag for internal team → verify rate limiting, export, deletion
5. Enable for beta users (1 week)
6. Gradual rollout: 10% → 50% → 100%

## Constitutional Compliance

- [x] **Type Safety First** — All new models have Prisma types, Zod validation on all inputs
- [x] **Test-Driven Development** — TDD enforced, 80%+ coverage target
- [x] **BYOK Architecture** — No platform API keys used (N/A for this feature)
- [x] **Minimal Abstractions** — One new dependency (@upstash/ratelimit), everything else is existing stack
- [x] **Security & Privacy** — IP hashing, audit logging, two-step deletion confirmation
- [x] **Phased Rollout with Feature Flags** — COMPLIANCE_SECURITY flag gates all new functionality
- [x] **Agent Autonomy** — N/A for this feature (no agent changes)

## Risks & Mitigation

| Risk                                  | Impact                       | Mitigation                                        |
| ------------------------------------- | ---------------------------- | ------------------------------------------------- |
| Upstash Redis unavailable             | Rate limiting disabled       | Fail-open design; log warning                     |
| Large account export timeout          | 429 or timeout               | Monitor export times; add async path if needed    |
| Cascade delete breaks FK constraints  | Deletion fails               | Test cascade thoroughly; retry via Inngest        |
| Clerk API unavailable during deletion | External auth not cleaned up | Retry with backoff; flag for manual review        |
| Rate limit too aggressive             | Legitimate users blocked     | Start with generous limits; tune based on metrics |
