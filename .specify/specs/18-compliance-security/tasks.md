# Task Breakdown — Feature 18: Compliance & Security

**Branch:** 18-compliance-security
**Plan:** .specify/specs/18-compliance-security/plan.md
**Total Tasks:** 30
**Phases:** 7

---

## Phase 1: Database & Infrastructure

### Task 1.1: Prisma Schema — New Models & Enum Additions

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None

**Description:**
Add `AuditLog` and `DeletionRequest` models to `prisma/schema.prisma`. Add enums: `AuditActorType`, `AuditResult`, `DeletionUserType`, `DeletionStatus`. Change `onDelete: Restrict` → `onDelete: Cascade` on AgentConversation (seeker, jobPosting) and Match (conversation, jobPosting, seeker, employer) relations. Run `prisma generate`.

**Acceptance Criteria:**

- [ ] AuditLog model with all fields from data-model.md
- [ ] DeletionRequest model with all fields from data-model.md
- [ ] All 4 new enums defined
- [ ] AgentConversation FK onDelete changed to Cascade
- [ ] Match FK onDelete changed to Cascade
- [ ] Indexes created per data-model.md
- [ ] `prisma generate` succeeds with zero errors

---

### Task 1.2: Feature Flag — COMPLIANCE_SECURITY

**Status:** 🟡 Ready
**Effort:** 0.25h
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Add `COMPLIANCE_SECURITY` feature flag to `src/lib/flags.ts` with `defaultValue: false`.

**Acceptance Criteria:**

- [ ] Flag exported as `COMPLIANCE_SECURITY`
- [ ] Default value is `false`
- [ ] Description references Feature 18

---

### Task 1.3: Audit Logging Utility — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 1h
**Dependencies:** Task 1.1

**Description:**
Write tests for `src/lib/audit.ts` — a platform-wide audit logging utility. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: logs entry with all required fields (actorId, actorType, action, result, createdAt)
- [ ] Test: includes optional fields (entityType, entityId, metadata, ipHash)
- [ ] Test: fire-and-forget — does not throw on DB error
- [ ] Test: IP hashing produces deterministic SHA-256 output
- [ ] Test: IP hashing returns null when no IP provided
- [ ] Tests confirmed to FAIL

---

### Task 1.4: Audit Logging Utility — Implementation

**Status:** 🔴 Blocked by 1.3
**Effort:** 1h
**Dependencies:** Task 1.3

**Description:**
Implement `src/lib/audit.ts` with `logAudit()` function and `hashIp()` helper. Follow existing `logActivity()` pattern (fire-and-forget).

**Acceptance Criteria:**

- [ ] All tests from 1.3 pass
- [ ] `logAudit()` writes to AuditLog table
- [ ] `hashIp()` uses SHA-256 with AUDIT_IP_SALT env var
- [ ] Fire-and-forget error handling (swallows exceptions)

---

### Task 1.5: Rate Limit Utility — Tests

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None
**Parallel with:** Task 1.3

**Description:**
Write tests for `src/lib/rate-limit.ts`. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: allows requests under limit
- [ ] Test: blocks requests exceeding limit
- [ ] Test: returns correct headers (limit, remaining, reset)
- [ ] Test: uses user ID for authenticated requests
- [ ] Test: uses IP hash for unauthenticated requests
- [ ] Test: different categories have different limits (auth, read, write, agent)
- [ ] Test: fails open when Redis unavailable (logs warning, allows request)
- [ ] Tests confirmed to FAIL

---

### Task 1.6: Rate Limit Utility — Implementation

**Status:** 🔴 Blocked by 1.5
**Effort:** 1.5h
**Dependencies:** Task 1.5

**Description:**
Implement `src/lib/rate-limit.ts` using `@upstash/ratelimit`. Install dependency. Create rate limiter instances per category. Export `checkRateLimit()` function.

**Acceptance Criteria:**

- [ ] All tests from 1.5 pass
- [ ] `@upstash/ratelimit` installed
- [ ] Rate limit categories: auth (20/min), read (100/min), write (30/min), agent (10/min), webhook (200/min)
- [ ] Sliding window algorithm used
- [ ] Fail-open when Redis unavailable
- [ ] Returns headers object { limit, remaining, reset }

---

## Phase 2: Core Backend — Data Export

### Task 2.1: Data Export Procedure — Tests

**Status:** 🔴 Blocked by 1.4
**Effort:** 2h
**Dependencies:** Task 1.4

**Description:**
Write tests for `compliance.exportMyData` tRPC procedure. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: seeker export includes profile, settings, matches, conversations, feedback
- [ ] Test: employer export includes company profile, job postings, matches, conversations, feedback
- [ ] Test: API keys (byokApiKeyEncrypted) excluded from export
- [ ] Test: conversation messages are redacted (reuse redaction.ts patterns)
- [ ] Test: export includes ISO 8601 exportedAt timestamp
- [ ] Test: audit log entry created for "data.exported" action
- [ ] Test: feature flag gates the procedure
- [ ] Tests confirmed to FAIL

---

### Task 2.2: Data Export Procedure — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2h
**Dependencies:** Task 2.1

**Description:**
Implement `compliance.exportMyData` in `src/server/api/routers/compliance.ts`. Detect user type from context and export appropriate data.

**Acceptance Criteria:**

- [ ] All tests from 2.1 pass
- [ ] Seeker path: queries JobSeeker + SeekerSettings + Match + AgentConversation + FeedbackInsights
- [ ] Employer path: queries Employer + JobPosting + JobSettings + Match + AgentConversation + FeedbackInsights
- [ ] byokApiKeyEncrypted fields excluded via Prisma `select`
- [ ] Conversation messages redacted using existing redaction utility
- [ ] Audit log entry written via `logAudit()`

---

## Phase 3: Core Backend — Data Deletion

### Task 3.1: Deletion Request Procedures — Tests

**Status:** 🔴 Blocked by 1.4
**Effort:** 2h
**Dependencies:** Task 1.4
**Parallel with:** Task 2.1

**Description:**
Write tests for `compliance.requestDeletion`, `compliance.cancelDeletion`, `compliance.getDeletionStatus`. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: requestDeletion creates DeletionRequest with PENDING status
- [ ] Test: requestDeletion sets scheduledAt = now + 72 hours
- [ ] Test: requestDeletion requires confirmation text "DELETE MY ACCOUNT"
- [ ] Test: requestDeletion rejects if deletion already pending (CONFLICT)
- [ ] Test: requestDeletion sends Inngest event with scheduled timestamp
- [ ] Test: requestDeletion logs "account.deletion_requested" to audit
- [ ] Test: cancelDeletion updates status to CANCELLED
- [ ] Test: cancelDeletion rejects if no pending deletion (NOT_FOUND)
- [ ] Test: cancelDeletion rejects if deletion already executing (BAD_REQUEST)
- [ ] Test: cancelDeletion logs "account.deletion_cancelled" to audit
- [ ] Test: getDeletionStatus returns hasPendingDeletion and request details
- [ ] Test: getDeletionStatus returns hasPendingDeletion:false when none exists
- [ ] Test: feature flag gates all procedures
- [ ] Tests confirmed to FAIL

---

### Task 3.2: Deletion Request Procedures — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5h
**Dependencies:** Task 3.1

**Description:**
Implement `compliance.requestDeletion`, `compliance.cancelDeletion`, `compliance.getDeletionStatus` in the compliance router.

**Acceptance Criteria:**

- [ ] All tests from 3.1 pass
- [ ] requestDeletion: creates DB record, sends Inngest event, logs audit
- [ ] cancelDeletion: updates DB record, logs audit
- [ ] getDeletionStatus: returns current state
- [ ] All gated behind COMPLIANCE_SECURITY flag

---

### Task 3.3: Account Deletion Inngest Function — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 2h
**Dependencies:** Task 1.1
**Parallel with:** Task 3.1

**Description:**
Write tests for `execute-account-deletion` Inngest function. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: skips execution if DeletionRequest status is CANCELLED
- [ ] Test: sets DeletionRequest status to EXECUTING
- [ ] Test: terminates active agent conversations (sets status TERMINATED)
- [ ] Test: closes active job postings for employer deletions
- [ ] Test: deletes JobSeeker record (Prisma cascades handle rest)
- [ ] Test: deletes Employer record (Prisma cascades handle rest)
- [ ] Test: deletes Clerk user account
- [ ] Test: sets DeletionRequest status to COMPLETED
- [ ] Test: sets DeletionRequest status to FAILED on error
- [ ] Test: logs "account.deletion_completed" to audit with SYSTEM actor
- [ ] Tests confirmed to FAIL

---

### Task 3.4: Account Deletion Inngest Function — Implementation

**Status:** 🔴 Blocked by 3.3
**Effort:** 2h
**Dependencies:** Task 3.3

**Description:**
Implement `src/server/inngest/functions/execute-account-deletion.ts`. Register in Inngest function index.

**Acceptance Criteria:**

- [ ] All tests from 3.3 pass
- [ ] Inngest function handles "compliance/account.deletion.execute" event
- [ ] Retry policy: 3 attempts with exponential backoff
- [ ] Graceful Clerk API error handling (retry, flag for manual review)
- [ ] Registered in `src/server/inngest/functions/index.ts`

---

## Phase 4: Rate Limiting Middleware

### Task 4.1: Rate Limiting tRPC Middleware — Tests

**Status:** 🔴 Blocked by 1.6
**Effort:** 1.5h
**Dependencies:** Task 1.6

**Description:**
Write tests for rate limiting middleware integrated into tRPC. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: middleware allows requests under limit
- [ ] Test: middleware returns TRPCError TOO_MANY_REQUESTS when exceeded
- [ ] Test: response includes rate limit headers
- [ ] Test: authenticated requests use userId for limiting
- [ ] Test: public procedures use IP-based limiting
- [ ] Test: different procedure types map to correct categories
- [ ] Test: middleware is transparent when Redis unavailable (fail-open)
- [ ] Tests confirmed to FAIL

---

### Task 4.2: Rate Limiting tRPC Middleware — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 1.5h
**Dependencies:** Task 4.1

**Description:**
Add rate limiting middleware to `src/server/api/trpc.ts`. Apply to all procedure builders. Map procedures to rate limit categories.

**Acceptance Criteria:**

- [ ] All tests from 4.1 pass
- [ ] Middleware added before authentication middleware
- [ ] Public procedures: IP-based limiting, "auth" category
- [ ] Protected procedures: user-based limiting, category based on mutation vs query
- [ ] Rate limit headers set via tRPC response metadata
- [ ] No impact on existing test suite (mocked in tests)

---

## Phase 5: Audit Extension & MFA

### Task 5.1: Audit Log Query Procedure — Tests

**Status:** 🔴 Blocked by 1.4
**Effort:** 1h
**Dependencies:** Task 1.4
**Parallel with:** Task 4.1

**Description:**
Write tests for `compliance.getAuditLog` admin procedure. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: returns paginated audit entries
- [ ] Test: filters by action type
- [ ] Test: filters by actorId
- [ ] Test: filters by date range (dateFrom, dateTo)
- [ ] Test: combines multiple filters
- [ ] Test: cursor-based pagination works correctly
- [ ] Test: requires admin role
- [ ] Tests confirmed to FAIL

---

### Task 5.2: Audit Log Query Procedure — Implementation

**Status:** 🔴 Blocked by 5.1
**Effort:** 0.75h
**Dependencies:** Task 5.1

**Description:**
Implement `compliance.getAuditLog` in the compliance router.

**Acceptance Criteria:**

- [ ] All tests from 5.1 pass
- [ ] Cursor-based pagination (same pattern as team.getActivityLog)
- [ ] Supports all filter combinations
- [ ] Admin-only access

---

### Task 5.3: MFA Status Procedures — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 1h
**Dependencies:** Task 1.2
**Parallel with:** Task 5.1

**Description:**
Write tests for `compliance.getMfaStatus` and `compliance.dismissMfaPrompt`. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: getMfaStatus returns mfaEnabled from Clerk user
- [ ] Test: getMfaStatus returns shouldPrompt:true when MFA not enabled and not recently dismissed
- [ ] Test: getMfaStatus returns shouldPrompt:false when MFA enabled
- [ ] Test: getMfaStatus returns shouldPrompt:false when dismissed < 7 days ago
- [ ] Test: dismissMfaPrompt stores timestamp in Clerk publicMetadata
- [ ] Test: feature flag gates both procedures
- [ ] Tests confirmed to FAIL

---

### Task 5.4: MFA Status Procedures — Implementation

**Status:** 🔴 Blocked by 5.3
**Effort:** 0.75h
**Dependencies:** Task 5.3

**Description:**
Implement `compliance.getMfaStatus` and `compliance.dismissMfaPrompt`. Use Clerk SDK to check MFA enrollment and store dismissal timestamp.

**Acceptance Criteria:**

- [ ] All tests from 5.3 pass
- [ ] Clerk SDK used to check `user.twoFactorEnabled`
- [ ] Dismissal stored in Clerk `publicMetadata.mfaDismissedAt`
- [ ] 7-day re-prompt interval

---

### Task 5.5: Audit Integration — Existing Routers

**Status:** 🔴 Blocked by 1.4, 2.2, 3.2
**Effort:** 1.5h
**Dependencies:** Tasks 1.4, 2.2, 3.2

**Description:**
Add `logAudit()` calls to existing routers for sensitive operations. No tests needed for this task — audit calls are fire-and-forget and validated by existing audit utility tests.

**Acceptance Criteria:**

- [ ] BYOK key rotation (byok router): logs "byok.key_rotated"
- [ ] Settings changes (settings router): logs "settings.updated" (no values in metadata)
- [ ] Match status changes (matches router): logs "match.status_changed"
- [ ] Subscription events (billing router): logs "subscription.changed"
- [ ] IP hash included where request context available
- [ ] No existing tests broken

---

### Task 5.6: Register Compliance Router

**Status:** 🔴 Blocked by 2.2, 3.2, 5.2, 5.4
**Effort:** 0.25h
**Dependencies:** Tasks 2.2, 3.2, 5.2, 5.4

**Description:**
Register the compliance router in `src/server/api/root.ts`.

**Acceptance Criteria:**

- [ ] `complianceRouter` imported and registered as `compliance`
- [ ] No type errors

---

## Phase 6: Frontend Integration

### Task 6.1: Compliance Settings Page (Seeker) — Tests

**Status:** 🔴 Blocked by 5.6
**Effort:** 1.5h
**Dependencies:** Task 5.6

**Description:**
Write component tests for seeker compliance settings page. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: renders data export button
- [ ] Test: clicking export triggers download
- [ ] Test: renders account deletion section
- [ ] Test: deletion requires typing confirmation phrase
- [ ] Test: shows deletion pending status with cancel button during grace period
- [ ] Test: MFA status displayed
- [ ] Tests confirmed to FAIL

---

### Task 6.2: Compliance Settings Page (Seeker) — Implementation

**Status:** 🔴 Blocked by 6.1
**Effort:** 1.5h
**Dependencies:** Task 6.1

**Description:**
Implement `src/app/(seeker)/settings/compliance/page.tsx`.

**Acceptance Criteria:**

- [ ] All tests from 6.1 pass
- [ ] Data export: calls compliance.exportMyData, triggers JSON file download
- [ ] Account deletion: two-step confirmation, calls compliance.requestDeletion
- [ ] Deletion pending: shows status, cancel button calls compliance.cancelDeletion
- [ ] MFA status section with link to Clerk MFA setup
- [ ] Follows existing page patterns (use client, tRPC, Tailwind)

---

### Task 6.3: Compliance Settings Page (Employer) — Tests

**Status:** 🔴 Blocked by 5.6
**Effort:** 1h
**Dependencies:** Task 5.6
**Parallel with:** Task 6.1

**Description:**
Write component tests for employer compliance settings page. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: renders data export and deletion sections (same as seeker)
- [ ] Test: admin-only access for deletion
- [ ] Test: MFA status displayed
- [ ] Tests confirmed to FAIL

---

### Task 6.4: Compliance Settings Page (Employer) — Implementation

**Status:** 🔴 Blocked by 6.3
**Effort:** 1h
**Dependencies:** Task 6.3

**Description:**
Implement `src/app/(employer)/settings/compliance/page.tsx`.

**Acceptance Criteria:**

- [ ] All tests from 6.3 pass
- [ ] Same functionality as seeker page adapted for employer context
- [ ] Admin role required for deletion actions

---

### Task 6.5: MFA Prompt Banner — Tests

**Status:** 🔴 Blocked by 5.4
**Effort:** 0.75h
**Dependencies:** Task 5.4
**Parallel with:** Task 6.1

**Description:**
Write component tests for MFA encouragement banner. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: renders banner when shouldPrompt is true
- [ ] Test: does not render when shouldPrompt is false
- [ ] Test: dismiss button calls compliance.dismissMfaPrompt
- [ ] Test: "Set up MFA" link present
- [ ] Tests confirmed to FAIL

---

### Task 6.6: MFA Prompt Banner — Implementation

**Status:** 🔴 Blocked by 6.5
**Effort:** 0.5h
**Dependencies:** Task 6.5

**Description:**
Implement `src/components/compliance/mfa-prompt-banner.tsx`. Dismissible banner with link to Clerk MFA setup.

**Acceptance Criteria:**

- [ ] All tests from 6.5 pass
- [ ] Renders conditionally based on compliance.getMfaStatus
- [ ] Dismissible with "Remind me later" button
- [ ] Links to Clerk MFA setup URL
- [ ] Tailwind styling, keyboard navigable

---

## Phase 7: Bias Audit & Documentation

### Task 7.1: Bias Audit Test Suite

**Status:** 🟡 Ready
**Effort:** 2h
**Dependencies:** None (uses existing agent evaluation code)
**Parallel with:** All Phase 6 tasks

**Description:**
Create bias detection test suite for the AI matching system. Tests verify that identical profiles differing only in protected characteristics produce equivalent match outcomes.

**Acceptance Criteria:**

- [ ] Test fixtures: identical profiles with varied names suggesting different demographics
- [ ] Test: match scores are equivalent across demographic variations
- [ ] Test: agent prompts contain no discriminatory language or proxy variables
- [ ] Test: protected characteristics (race, gender, age, disability, religion, national origin) covered
- [ ] Tests pass against current agent evaluation logic

---

### Task 7.2: Bias Audit Checklist & SOC 2 Documentation

**Status:** 🟡 Ready
**Effort:** 2h
**Dependencies:** None
**Parallel with:** Task 7.1

**Description:**
Create bias audit checklist and SOC 2 control mapping documentation. Store in `.specify/specs/18-compliance-security/docs/`.

**Acceptance Criteria:**

- [ ] `docs/bias-audit-checklist.md`: all EEOC protected characteristics documented
- [ ] `docs/bias-audit-checklist.md`: process for periodic re-audit defined
- [ ] `docs/soc2-control-mapping.md`: Security, Availability, Processing Integrity, Confidentiality, Privacy mapped
- [ ] `docs/soc2-control-mapping.md`: each control maps to JobBobber implementation
- [ ] `docs/soc2-control-mapping.md`: gaps identified with remediation plan

---

## Phase 8: Quality Validation

### Task 8.1: Full Test Suite Run

**Status:** 🔴 Blocked by all implementation tasks
**Effort:** 0.5h
**Dependencies:** Tasks 1.4, 1.6, 2.2, 3.2, 3.4, 4.2, 5.2, 5.4, 5.5, 6.2, 6.4, 6.6, 7.1

**Description:**
Run complete test suite. Verify zero regressions. Verify 80%+ coverage on new code.

**Acceptance Criteria:**

- [ ] All existing tests pass
- [ ] All new tests pass
- [ ] No TypeScript errors
- [ ] ESLint passes with zero warnings

---

### Task 8.2: Security Review

**Status:** 🔴 Blocked by 8.1
**Effort:** 1h
**Dependencies:** Task 8.1

**Description:**
Security review of all compliance-sensitive code: data export (no leakage), deletion cascade (completeness), rate limiting (no bypass), audit logging (no sensitive data).

**Acceptance Criteria:**

- [ ] Data export excludes API keys
- [ ] Deletion cascade covers all user data
- [ ] Rate limiting cannot be bypassed
- [ ] Audit log contains no sensitive values
- [ ] IP hashing is one-way
- [ ] No hardcoded secrets

---

## User Story → Task Mapping

| User Story                        | Tasks                       |
| --------------------------------- | --------------------------- |
| US-1: Full Data Export            | 2.1, 2.2, 6.1-6.4           |
| US-2: Account & Data Deletion     | 3.1, 3.2, 3.3, 3.4, 6.1-6.4 |
| US-3: Comprehensive Audit Logging | 1.3, 1.4, 5.1, 5.2, 5.5     |
| US-4: API Rate Limiting           | 1.5, 1.6, 4.1, 4.2          |
| US-5: MFA Encouragement           | 5.3, 5.4, 6.5, 6.6          |
| US-6: AI Matching Bias Audit      | 7.1                         |
| US-7: SOC 2 Readiness             | 7.2                         |

## Critical Path

```
1.1 → 1.3 → 1.4 → 2.1 → 2.2 → 5.5 → 5.6 → 6.1 → 6.2 → 8.1 → 8.2
```

**Duration:** ~16h on critical path

## Parallelization Opportunities

- **Phase 1:** Tasks 1.1 ∥ 1.2 ∥ 1.5 (all independent)
- **Phase 2-3:** Tasks 2.1 ∥ 3.1 ∥ 3.3 (after 1.4, all independent)
- **Phase 5:** Tasks 5.1 ∥ 5.3 (independent audit vs MFA)
- **Phase 6:** Tasks 6.1 ∥ 6.3 ∥ 6.5 (independent UI components)
- **Phase 7:** Tasks 7.1 ∥ 7.2 (independent, parallel with Phase 6)
