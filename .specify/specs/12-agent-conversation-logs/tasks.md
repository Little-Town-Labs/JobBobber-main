# Task Breakdown: Feature 12 — Agent Conversation Logs

## Phase 1: Foundation (Schema + Redaction + Flag)

### Task 1.1: Prisma Migration — dataUsageOptOut

**Status:** 🟡 Ready
**Effort:** 0.5 hours
**Dependencies:** None

**Description:**
Add `dataUsageOptOut Boolean @default(false)` to `SeekerSettings` and `Employer` models. Create and apply migration.

**Acceptance Criteria:**

- [ ] Field added to both models in schema.prisma
- [ ] Migration SQL generated and validated
- [ ] `prisma generate` succeeds

---

### Task 1.2: Feature Flag — CONVERSATION_LOGS

**Status:** 🟡 Ready
**Effort:** 0.25 hours
**Dependencies:** None
**Parallel with:** Task 1.1, Task 1.3

**Description:**
Add `CONVERSATION_LOGS` feature flag to `src/lib/flags.ts` following existing pattern (default off).

**Acceptance Criteria:**

- [ ] Flag defined with `defaultValue: false`
- [ ] Description documents Feature 12

---

### Task 1.3: Redaction Utility — Tests

**Status:** 🟡 Ready
**Effort:** 1 hour
**Dependencies:** None
**Parallel with:** Task 1.1, Task 1.2

**Description:**
Write tests for `redactMessage()` and `redactConversationMessages()` utilities. **TESTS FIRST**.

**Acceptance Criteria:**

- [ ] Tests for dollar amount patterns ($100,000, $100k, $100K, $100,000.00)
- [ ] Tests for salary range patterns ($80k-$120k, $80,000 - $120,000)
- [ ] Tests for percentage patterns (85%, 90.5%)
- [ ] Tests that `evaluation` and `decision` fields are stripped
- [ ] Tests that safe fields (role, phase, timestamp, turnNumber) are preserved
- [ ] Tests for edge cases: no sensitive content, fully redacted message, empty content
- [ ] Tests confirmed to FAIL

**Maps to:** US-3 (Sensitive Data Redaction), FR-003, FR-004

---

### Task 1.4: Redaction Utility — Implementation

**Status:** 🔴 Blocked by 1.3
**Effort:** 1 hour
**Dependencies:** Task 1.3

**Description:**
Implement `redactMessage()` in `src/lib/redaction.ts`. Two-layer approach: field stripping + content regex.

**Acceptance Criteria:**

- [ ] All tests from 1.3 pass
- [ ] Exports `redactMessage()` and `redactConversationMessages()`
- [ ] Zod schema for `RedactedMessage` response type
- [ ] No `any` types

---

## Phase 2: API Layer (tRPC Router)

### Task 2.1: Conversations Router — Tests

**Status:** 🔴 Blocked by 1.1, 1.4
**Effort:** 2 hours
**Dependencies:** Task 1.1, Task 1.4

**Description:**
Write integration tests for the `conversations` tRPC router. **TESTS FIRST**.

**Acceptance Criteria:**

- [ ] `listForSeeker`: returns only seeker's conversations, cursor pagination works, status filter works
- [ ] `listForSeeker`: sorted by most recent activity
- [ ] `listForEmployer`: requires jobPostingId, returns only employer's posting conversations
- [ ] `listForEmployer`: rejects if employer doesn't own the posting
- [ ] `getById`: returns conversation with redacted messages
- [ ] `getById`: rejects if user doesn't own the conversation (seeker or employer)
- [ ] `getById`: includes candidateName for employer, jobPostingTitle for both
- [ ] Empty results return empty array with hasMore: false
- [ ] Tests confirmed to FAIL

**Maps to:** US-1, US-2, US-5, FR-001, FR-002, FR-006, FR-007

---

### Task 2.2: Conversations Router — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2 hours
**Dependencies:** Task 2.1

**Description:**
Implement `src/server/api/routers/conversations.ts` with three endpoints. Register in app router.

**Acceptance Criteria:**

- [ ] All tests from 2.1 pass
- [ ] `listForSeeker` uses seekerProcedure, cursor pagination (limit 20 default)
- [ ] `listForEmployer` uses employerProcedure, validates posting ownership
- [ ] `getById` uses protectedProcedure, verifies ownership (seeker or employer)
- [ ] Messages redacted via `redactConversationMessages()`
- [ ] Zod input validation on all endpoints
- [ ] Router registered in `src/server/api/root.ts`

---

### Task 2.3: Data Usage Opt-Out Endpoint — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 0.5 hours
**Dependencies:** Task 1.1
**Parallel with:** Task 2.1

**Description:**
Write tests for `settings.updateDataUsageOptOut` endpoint. **TESTS FIRST**.

**Acceptance Criteria:**

- [ ] Seeker can toggle opt-out preference
- [ ] Employer can toggle opt-out preference
- [ ] Returns updated preference value
- [ ] Tests confirmed to FAIL

**Maps to:** US-4, FR-005

---

### Task 2.4: Data Usage Opt-Out Endpoint — Implementation

**Status:** 🔴 Blocked by 2.3
**Effort:** 0.5 hours
**Dependencies:** Task 2.3

**Description:**
Add `updateDataUsageOptOut` mutation to existing settings router.

**Acceptance Criteria:**

- [ ] All tests from 2.3 pass
- [ ] Zod input validation (boolean)
- [ ] Updates correct model based on user role

---

### Task 2.5: Security Review

**Status:** 🔴 Blocked by 2.2, 2.4
**Effort:** 0.5 hours
**Dependencies:** Task 2.2, Task 2.4

**Description:**
Run `/security-review` on conversations router and redaction utility.

**Acceptance Criteria:**

- [ ] No IDOR vulnerabilities (ownership verified on every query)
- [ ] No sensitive data leakage (evaluations, decisions stripped)
- [ ] Authorization enforced on all endpoints
- [ ] All CRITICAL/HIGH issues resolved

---

## Phase 3: Frontend (Dashboard Components)

### Task 3.1: ConversationList Component — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1 hour
**Dependencies:** Task 2.2
**Parallel with:** Task 3.3

**Description:**
Write component tests for `ConversationList`. **TESTS FIRST**.

**Acceptance Criteria:**

- [ ] Renders conversation summaries with status badges
- [ ] Shows job posting title, message count, timestamps
- [ ] Empty state displayed when no conversations
- [ ] Loading skeleton shown during fetch
- [ ] Error state with retry button
- [ ] Pagination loads more on scroll/button
- [ ] Tests confirmed to FAIL

**Maps to:** US-1, US-2, US-5

---

### Task 3.2: ConversationList Component — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5 hours
**Dependencies:** Task 3.1

**Description:**
Implement `ConversationList` component using tRPC query hooks.

**Acceptance Criteria:**

- [ ] All tests from 3.1 pass
- [ ] Uses `trpc.conversations.listForSeeker` or `listForEmployer` based on context
- [ ] Status badges with color coding (not color-only — accessible)
- [ ] Cursor pagination with "Load more" or infinite scroll
- [ ] Empty, loading, error states

---

### Task 3.3: ConversationDetail Component — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1 hour
**Dependencies:** Task 2.2
**Parallel with:** Task 3.1

**Description:**
Write component tests for `ConversationDetail`. **TESTS FIRST**.

**Acceptance Criteria:**

- [ ] Renders messages in chronological order
- [ ] Shows role attribution (seeker agent / employer agent) with labels, not just color
- [ ] Shows timestamps per message
- [ ] Shows phase indicators
- [ ] Displays "[REDACTED]" placeholders visibly
- [ ] "Conversation in progress" indicator for IN_PROGRESS status
- [ ] Tests confirmed to FAIL

**Maps to:** US-1, US-2, US-3, FR-002, FR-004

---

### Task 3.4: ConversationDetail Component — Implementation

**Status:** 🔴 Blocked by 3.3
**Effort:** 1.5 hours
**Dependencies:** Task 3.3

**Description:**
Implement `ConversationDetail` as a message timeline view.

**Acceptance Criteria:**

- [ ] All tests from 3.3 pass
- [ ] Uses `trpc.conversations.getById`
- [ ] Message bubbles with role attribution and timestamps
- [ ] Phase labels between message groups
- [ ] Scrollable for long conversations
- [ ] Keyboard navigable

---

### Task 3.5: Dashboard Page Integration

**Status:** 🔴 Blocked by 3.2, 3.4
**Effort:** 1 hour
**Dependencies:** Task 3.2, Task 3.4

**Description:**
Add conversation log pages to seeker and employer dashboards. Add opt-out toggle to settings pages.

**Acceptance Criteria:**

- [ ] Seeker: `/conversations` page with list → detail navigation
- [ ] Employer: `/dashboard/conversations` page with job posting filter
- [ ] Settings: data usage opt-out toggle on both seeker and employer settings pages
- [ ] Feature flag gating on all routes
- [ ] Navigation links added to sidebar/header

**Maps to:** US-1, US-2, US-4

---

## Phase 4: Integration & Polish

### Task 4.1: Code Review

**Status:** 🔴 Blocked by 3.5
**Effort:** 0.5 hours
**Dependencies:** Task 3.5

**Description:**
Run `/code-review` on all new files.

**Acceptance Criteria:**

- [ ] All CRITICAL/HIGH issues resolved
- [ ] TypeScript compilation passes
- [ ] ESLint passes
- [ ] Prettier applied

---

### Task 4.2: Accessibility & Performance Validation

**Status:** 🔴 Blocked by 3.5
**Effort:** 0.5 hours
**Dependencies:** Task 3.5
**Parallel with:** Task 4.1

**Description:**
Validate accessibility (NFR-003) and performance (NFR-001) requirements.

**Acceptance Criteria:**

- [ ] Keyboard navigation works on list and detail views
- [ ] Screen reader labels on role attribution and status badges
- [ ] Color is not sole differentiator (text labels present)
- [ ] List loads < 500ms, detail loads < 300ms (with mock data)

**Maps to:** NFR-001, NFR-003

---

## Summary

| Phase          | Tasks        | Effort          |
| -------------- | ------------ | --------------- |
| 1. Foundation  | 4 tasks      | 2.75 hours      |
| 2. API Layer   | 5 tasks      | 5.5 hours       |
| 3. Frontend    | 5 tasks      | 6 hours         |
| 4. Integration | 2 tasks      | 1 hour          |
| **Total**      | **16 tasks** | **15.25 hours** |

## Critical Path

```
1.3 → 1.4 → 2.1 → 2.2 → 3.1 → 3.2 → 3.5 → 4.1
```

**Duration:** ~9.5 hours on critical path

## Parallelization Opportunities

- Phase 1: Tasks 1.1, 1.2, 1.3 all independent (run in parallel)
- Phase 2: Tasks 2.1 and 2.3 independent (different endpoints)
- Phase 3: Tasks 3.1 and 3.3 independent (different components)
- Phase 4: Tasks 4.1 and 4.2 independent (review vs validation)

## User Story → Task Mapping

| User Story                | Tasks                             |
| ------------------------- | --------------------------------- |
| US-1: Seeker Views Logs   | 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5 |
| US-2: Employer Views Logs | 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5 |
| US-3: Redaction           | 1.3, 1.4, 2.1, 2.2, 3.3, 3.4      |
| US-4: Data Usage Opt-Out  | 1.1, 2.3, 2.4, 3.5                |
| US-5: Empty/Error States  | 3.1, 3.2, 3.3, 3.4                |
