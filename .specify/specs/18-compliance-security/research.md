# Technology Research — Feature 18: Compliance & Security

## Decision 1: Rate Limiting Strategy

**Context:** All tRPC endpoints need per-user and per-IP rate limiting. The application runs on Vercel (serverless) with NeonDB (PostgreSQL).

**Options Considered:**

1. **@upstash/ratelimit + Upstash Redis**
   - Pros: Designed for serverless, sliding window algorithm, sub-5ms latency, Vercel integration
   - Cons: External dependency (Upstash), adds cost (~$0.20/100K commands)
   - License: MIT

2. **In-memory rate limiting (Map-based)**
   - Pros: Zero external dependencies, zero cost
   - Cons: Per-instance state (doesn't share across serverless invocations), no persistence across cold starts, useless on Vercel
   - Not viable for serverless

3. **Database-backed rate limiting (NeonDB)**
   - Pros: No new infrastructure, shared state
   - Cons: Adds latency per request (~20-50ms), increases DB load, defeats performance requirement (<5ms)
   - Not recommended

**Chosen:** @upstash/ratelimit + Upstash Redis
**Rationale:** Only viable option for serverless. Sliding window provides smooth rate limiting. Sub-5ms latency meets NFR-1. Well-tested in Vercel ecosystem. The `@upstash/ratelimit` SDK is MIT licensed and purpose-built for this exact scenario.
**Tradeoffs:** Adds external service dependency (Upstash Redis). Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. ~$0.20/100K commands at scale. Falls back to fail-open if Redis unavailable (per NFR-3).

---

## Decision 2: Data Export Format & Generation

**Context:** GDPR Article 20 requires machine-readable data portability. Exports include profile, settings, matches, conversations, and insights.

**Options Considered:**

1. **Server-side JSON generation (tRPC procedure)**
   - Pros: Simple, leverages existing Prisma queries, single endpoint, no background job needed for small accounts
   - Cons: May timeout for very large accounts on serverless (30s limit)

2. **Background job via Inngest (async export)**
   - Pros: No timeout concerns, handles arbitrarily large exports, sends email when ready
   - Cons: More complex, requires file storage for download link, delayed delivery

3. **Hybrid: synchronous for small, async for large**
   - Pros: Best UX for most users (instant), handles edge cases
   - Cons: Two code paths, more complexity

**Chosen:** Server-side JSON generation (synchronous tRPC procedure)
**Rationale:** Most accounts will have < 1000 matches. Prisma queries are efficient with proper `select`. JSON generation is fast. 30-second Vercel timeout is sufficient for typical accounts. If scale becomes a concern later, we can add Inngest-based async export without breaking the API contract. YAGNI principle applies.
**Tradeoffs:** Very large accounts (10K+ matches) may timeout. Can add async path later if needed.

---

## Decision 3: Data Deletion Strategy

**Context:** GDPR Article 17 requires right to erasure. Must cascade across all related entities. Need 72-hour grace period.

**Options Considered:**

1. **Inngest delayed function (scheduled deletion)**
   - Pros: Reliable scheduling, retry on failure, visibility into job status, already in stack
   - Cons: None significant — Inngest is already used for async workflows

2. **Database-level scheduled job (pg_cron)**
   - Pros: No application-level scheduling
   - Cons: NeonDB doesn't support pg_cron, requires database admin access

3. **Vercel Cron + API route**
   - Pros: Simple scheduling
   - Cons: Less reliable than Inngest for critical operations, no built-in retry

**Chosen:** Inngest delayed function
**Rationale:** Inngest is already the workflow engine. `inngest.send()` with `ts` (scheduled time) handles the 72-hour delay. Built-in retry policy handles transient failures. Cancelable by removing the pending event. Aligns with Constitution IV (Minimal Abstractions) — no new infra.
**Tradeoffs:** Depends on Inngest reliability (already an accepted dependency).

---

## Decision 4: Audit Log Architecture

**Context:** Existing `ActivityLog` model captures employer team actions. Need to extend to platform-wide sensitive operations for all user types.

**Options Considered:**

1. **Extend existing ActivityLog model**
   - Pros: No schema migration complexity, reuse existing code
   - Cons: ActivityLog is employer-scoped (has `employerId` FK), not designed for seeker actions or platform-level events

2. **New AuditLog model (platform-wide)**
   - Pros: Clean separation, designed for compliance, supports both seekers and employers, can add IP hash
   - Cons: New table, migration needed, separate from team activity log

3. **External audit service (e.g., Pangea, AWS CloudTrail)**
   - Pros: Tamper-proof, managed
   - Cons: Over-engineering, external dependency, cost, violates Minimal Abstractions

**Chosen:** New AuditLog model (platform-wide)
**Rationale:** ActivityLog is employer-team-scoped with `employerId` FK — extending it for seeker actions would require nullable FK or structural changes. A separate `AuditLog` table with `actorId` (Clerk user ID), `actorType`, and optional `entityId` provides clean, universal coverage. Keeps existing team activity log intact (no breaking changes).
**Tradeoffs:** Two log tables (ActivityLog for team, AuditLog for compliance). Accept this — they serve different purposes and audiences.

---

## Decision 5: IP Address Hashing

**Context:** Audit logs should capture IP for security investigation without storing raw PII.

**Options Considered:**

1. **SHA-256 with application salt**
   - Pros: One-way, deterministic (same IP always maps to same hash for correlation), simple
   - Cons: If salt is compromised, IPs can be brute-forced (only ~4B IPv4 addresses)

2. **HMAC-SHA-256 with rotating key**
   - Pros: Keyed hash prevents rainbow table attacks even if hash leaks
   - Cons: Key rotation means historical hashes can't be correlated

3. **No IP storage**
   - Pros: No PII concern
   - Cons: Loses security investigation capability

**Chosen:** SHA-256 with application salt (AUDIT_IP_SALT env var)
**Rationale:** Deterministic hashing allows correlation of events from the same IP across time. The salt provides protection against casual rainbow table attacks. For a job platform (not a financial institution), this provides adequate security investigation capability. The 4B IPv4 brute-force concern is mitigated by keeping the salt secret.
**Tradeoffs:** If salt is compromised, IPs can be enumerated. Acceptable risk for this use case.

---

## Decision 6: Clerk MFA Integration

**Context:** Need to check MFA enrollment status and encourage users to enable it.

**Options Considered:**

1. **Clerk `useUser()` hook + server-side Clerk SDK**
   - Pros: Already in stack, `user.twoFactorEnabled` available, no custom MFA implementation
   - Cons: Limited to Clerk's MFA options (TOTP, SMS, backup codes)

2. **Custom MFA implementation**
   - Pros: Full control
   - Cons: Massive effort, security risk, reinventing the wheel

**Chosen:** Clerk SDK integration
**Rationale:** Clerk already handles auth. Their MFA APIs expose enrollment status. We only need to check and prompt — not implement MFA ourselves. Constitution IV (Minimal Abstractions).
**Tradeoffs:** Limited to Clerk's MFA methods. Acceptable — TOTP + backup codes covers the need.

---

## Decision 7: Deletion Cascade — Restrict vs Cascade

**Context:** Current schema uses `onDelete: Restrict` for AgentConversation and Match FKs. This will block deletion unless handled.

**Approach:**

- Change `AgentConversation.seeker` and `AgentConversation.jobPosting` to `onDelete: Cascade`
- Change `Match` FKs (conversation, jobPosting, seeker, employer) to `onDelete: Cascade`
- This enables full cascading deletion from the root entity (JobSeeker or Employer)
- The deletion Inngest function will handle the cascade order: terminate active conversations → delete matches → delete conversations → delete profile

**Rationale:** `Restrict` was appropriate when deletion wasn't supported. Now that GDPR requires right-to-erasure, we must enable cascading. The Inngest function ensures proper ordering.
