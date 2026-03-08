# Task Breakdown: Feature 14 — Aggregate Feedback Insights

**Branch:** 14-aggregate-feedback-insights
**Plan:** .specify/specs/14-aggregate-feedback-insights/plan.md
**Total Tasks:** 22
**Phases:** 6

---

## Phase 1: Schema & Flag (Foundation)

### Task 1.1: Prisma Schema Migration

**Status:** 🟡 Ready
**Effort:** 0.5 hours
**Dependencies:** None

**Description:**
Add `lastInsightConversationCount Int @default(0)` field to the existing `FeedbackInsights` model. Run `prisma migrate dev` to create migration.

**Acceptance Criteria:**

- [ ] `lastInsightConversationCount` field added to FeedbackInsights
- [ ] Migration created and applied cleanly
- [ ] `npx prisma generate` succeeds

---

### Task 1.2: Feature Flag Verification

**Status:** 🟡 Ready
**Effort:** 0.25 hours
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Verify that the existing `FEEDBACK_INSIGHTS` flag in `src/lib/flags.ts` is correctly configured. Update description to reference Feature 14 instead of Feature 9.

**Acceptance Criteria:**

- [ ] Flag description updated to reference Feature 14
- [ ] Flag works with `assertFlagEnabled(FEEDBACK_INSIGHTS)`

---

## Phase 2: Aggregation Engine (Core Logic)

### Task 2.1: Insight Schemas — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 1 hour
**Dependencies:** Task 1.1

**Description:**
Write tests for Zod schemas that define the LLM input (aggregated stats) and output (strengths, weaknesses, recommendations). **TESTS FIRST.**

**File:** `src/server/insights/insight-schemas.test.ts`

**Acceptance Criteria:**

- [ ] Tests validate LLM output schema (max 5 items per array, max char limits)
- [ ] Tests validate aggregation input schema (conversation counts, rates, patterns)
- [ ] Tests reject invalid/malformed data
- [ ] Tests confirmed to FAIL

**User Stories:** US-4 (privacy), FR-7 (structured output), FR-9 (content structure)

---

### Task 2.2: Insight Schemas — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 0.5 hours
**Dependencies:** Task 2.1

**Description:**
Implement Zod schemas for insight generation input and output.

**File:** `src/server/insights/insight-schemas.ts`

**Acceptance Criteria:**

- [ ] All tests from 2.1 pass
- [ ] `InsightGenerationInput` schema covers all aggregate fields
- [ ] `InsightGenerationOutput` schema with bounded arrays (max 5 items, max 200/300 chars)
- [ ] Exported for use by aggregation and generation modules

---

### Task 2.3: Aggregate Statistics — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 2 hours
**Dependencies:** Task 2.2

**Description:**
Write tests for the aggregation function that computes anonymized statistics from conversations and matches. **TESTS FIRST.** This is the privacy-critical function — tests must verify no PII leaks.

**File:** `src/server/insights/aggregate-stats.test.ts`

**Acceptance Criteria:**

- [ ] Tests for seeker aggregation (conversation counts, match rates, confidence distribution)
- [ ] Tests for employer aggregation (per-posting and overall)
- [ ] Tests for trend calculation (last 5 vs overall)
- [ ] Tests for bounded aggregation (caps at 50 conversations)
- [ ] **Privacy tests**: verify output contains no names, IDs, messages, or salary figures
- [ ] Tests for edge cases: zero conversations, all no-match, single conversation
- [ ] Tests confirmed to FAIL

**User Stories:** US-1, US-2, US-4 (privacy), FR-1, FR-3, FR-6

---

### Task 2.4: Aggregate Statistics — Implementation

**Status:** 🔴 Blocked by 2.3
**Effort:** 2 hours
**Dependencies:** Task 2.3

**Description:**
Implement `buildSeekerInsightContext()` and `buildEmployerInsightContext()` functions that query conversations and matches, then return anonymized aggregate statistics conforming to the input schema.

**File:** `src/server/insights/aggregate-stats.ts`

**Acceptance Criteria:**

- [ ] All tests from 2.3 pass
- [ ] Functions return only schema-validated aggregates
- [ ] Trend calculation compares last 5 conversations to overall
- [ ] Bounded to last 50 conversations for pattern analysis
- [ ] No raw messages, names, or private params in output

---

### Task 2.5: LLM Insight Generation — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1.5 hours
**Dependencies:** Task 2.2
**Parallel with:** Task 2.3

**Description:**
Write tests for the LLM insight generation function. Mock LLM calls with deterministic responses. **TESTS FIRST.**

**File:** `src/server/insights/generate-insights.test.ts`

**Acceptance Criteria:**

- [ ] Tests mock Vercel AI SDK `generateObject()` call
- [ ] Tests verify Zod schema validation of LLM output
- [ ] Tests for malformed LLM response (rejected, not stored)
- [ ] Tests for missing BYOK key (returns metrics-only result)
- [ ] Tests verify prompt does not contain PII
- [ ] Tests confirmed to FAIL

**User Stories:** US-1, US-2, FR-1, FR-7

---

### Task 2.6: LLM Insight Generation — Implementation

**Status:** 🔴 Blocked by 2.5
**Effort:** 1.5 hours
**Dependencies:** Task 2.5

**Description:**
Implement `generateFeedbackInsights()` that takes aggregate stats and a BYOK key, calls the LLM via Vercel AI SDK `generateObject()`, validates output with Zod, and returns structured insights.

**File:** `src/server/insights/generate-insights.ts`

**Acceptance Criteria:**

- [ ] All tests from 2.5 pass
- [ ] Uses `generateObject()` with Zod schema
- [ ] Prompt includes aggregate stats only (no PII)
- [ ] Returns null/metrics-only when no BYOK key provided
- [ ] Retries up to 3 times on malformed output

---

## Phase 3: Inngest Workflow (Background Processing)

### Task 3.1: Generate Feedback Insights Function — Tests

**Status:** 🔴 Blocked by 2.4, 2.6
**Effort:** 2 hours
**Dependencies:** Tasks 2.4, 2.6

**Description:**
Write tests for the Inngest function that orchestrates the full insight generation pipeline. **TESTS FIRST.**

**File:** `src/server/inngest/functions/generate-feedback-insights.test.ts`

**Acceptance Criteria:**

- [ ] Tests mock DB, LLM, and BYOK decryption
- [ ] Tests verify step execution order (aggregate → resolve key → generate → upsert)
- [ ] Tests for seeker and employer paths
- [ ] Tests for missing BYOK key (metrics-only upsert)
- [ ] Tests for below-threshold (skips generation)
- [ ] Tests for idempotent upsert (same user, same data = same result)
- [ ] Tests confirmed to FAIL

**User Stories:** US-3 (regeneration), FR-4

---

### Task 3.2: Generate Feedback Insights Function — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 2 hours
**Dependencies:** Task 3.1

**Description:**
Implement the Inngest function `generate-feedback-insights` with event `insights/generate`. Orchestrates aggregation, BYOK resolution, LLM call, and upsert.

**File:** `src/server/inngest/functions/generate-feedback-insights.ts`

**Acceptance Criteria:**

- [ ] All tests from 3.1 pass
- [ ] Inngest function with proper step isolation
- [ ] Handles seeker and employer userTypes
- [ ] Upserts FeedbackInsights with unique constraint on [userId, userType]
- [ ] Updates `lastInsightConversationCount`
- [ ] Registered in `src/server/inngest/functions/index.ts`

---

### Task 3.3: Threshold Check Function — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 1 hour
**Dependencies:** Task 1.1
**Parallel with:** Task 2.1

**Description:**
Write tests for the lightweight Inngest function that checks if a user has enough new conversations to trigger regeneration. **TESTS FIRST.**

**File:** `src/server/inngest/functions/check-insight-threshold.test.ts`

**Acceptance Criteria:**

- [ ] Tests verify threshold logic (currentCount - lastCount >= 3)
- [ ] Tests verify event dispatch when threshold met
- [ ] Tests verify no dispatch when below threshold
- [ ] Tests for first-time generation (no existing FeedbackInsights record)
- [ ] Tests confirmed to FAIL

**User Stories:** US-3, FR-2, FR-4

---

### Task 3.4: Threshold Check Function — Implementation

**Status:** 🔴 Blocked by 3.3
**Effort:** 0.75 hours
**Dependencies:** Task 3.3

**Description:**
Implement the threshold check Inngest function. Event: `insights/conversation.completed`. Checks delta and dispatches `insights/generate` if threshold met.

**File:** `src/server/inngest/functions/check-insight-threshold.ts`

**Acceptance Criteria:**

- [ ] All tests from 3.3 pass
- [ ] Queries FeedbackInsights for `lastInsightConversationCount`
- [ ] Queries current completed conversation count
- [ ] Dispatches `insights/generate` when delta >= threshold
- [ ] Registered in Inngest function index

---

### Task 3.5: Conversation Completion Event Emission

**Status:** 🔴 Blocked by 3.4
**Effort:** 0.5 hours
**Dependencies:** Task 3.4

**Description:**
Add `insights/conversation.completed` event emission to the `runAgentConversation` Inngest function when a conversation reaches terminal status.

**File:** `src/server/inngest/functions/run-agent-conversation.ts` (modify)

**Acceptance Criteria:**

- [ ] Event emitted on COMPLETED_MATCH, COMPLETED_NO_MATCH, and TERMINATED
- [ ] Event payload includes `userId` and `userType` for both seeker and employer
- [ ] Existing tests still pass
- [ ] No behavior change for conversation logic itself

---

## Phase 4: tRPC Router (API Layer)

### Task 4.1: Insights Router — Tests

**Status:** 🔴 Blocked by 2.4
**Effort:** 2 hours
**Dependencies:** Task 2.4

**Description:**
Write tests for the full insights router (replacing stubs). **TESTS FIRST.**

**File:** `src/server/api/routers/insights.test.ts`

**Acceptance Criteria:**

- [ ] Tests for `getSeekerInsights` — returns insights, returns null below threshold, returns threshold progress
- [ ] Tests for `getEmployerInsights` — returns insights, optional posting scope, ownership check
- [ ] Tests for `refreshInsights` — sends Inngest event, rate limiting (rejects if < 1 hour since last)
- [ ] Tests for feature flag gating (all procedures return NOT_FOUND when flag off)
- [ ] Tests confirmed to FAIL

**User Stories:** US-1, US-2, US-3, US-5, FR-5, FR-8

---

### Task 4.2: Insights Router — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 2 hours
**Dependencies:** Task 4.1

**Description:**
Replace stub `insightsRouter` with full implementation of all three procedures.

**File:** `src/server/api/routers/insights.ts` (replace)

**Acceptance Criteria:**

- [ ] All tests from 4.1 pass
- [ ] `getSeekerInsights` — queries FeedbackInsights, includes threshold progress
- [ ] `getEmployerInsights` — queries for employer, optional jobPostingId filter
- [ ] `refreshInsights` — rate-limited (1/hour), sends Inngest event
- [ ] All procedures gated with `assertFlagEnabled(FEEDBACK_INSIGHTS)`
- [ ] Response includes `belowThreshold` flag and `thresholdProgress`

---

## Phase 5: Dashboard UI (Frontend)

### Task 5.1: Insights Panel Component — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1.5 hours
**Dependencies:** Task 4.2

**Description:**
Write UI component tests for the insights panel. **TESTS FIRST.**

**File:** `tests/unit/components/insights/insights-panel.test.tsx`

**Acceptance Criteria:**

- [ ] Tests for full insights display (strengths, weaknesses, recommendations, metrics, trend)
- [ ] Tests for empty state (zero conversations)
- [ ] Tests for below-threshold state (progress indicator)
- [ ] Tests for stale insights indicator (>30 days)
- [ ] Tests for no-BYOK state (metrics only, prompt to configure key)
- [ ] Tests for loading state
- [ ] Tests for manual refresh button (click triggers refresh, shows loading)
- [ ] Tests confirmed to FAIL

**User Stories:** US-1, US-2, US-5

---

### Task 5.2: Insights Panel Component — Implementation

**Status:** 🔴 Blocked by 5.1
**Effort:** 2 hours
**Dependencies:** Task 5.1

**Description:**
Implement the shared `InsightsPanel` component used by both seeker and employer dashboards.

**File:** `src/components/insights/insights-panel.tsx`

**Acceptance Criteria:**

- [ ] All tests from 5.1 pass
- [ ] Displays strengths, weaknesses, recommendations as lists
- [ ] Shows metrics (total conversations, match rate, conversion rate)
- [ ] Shows trend direction with visual indicator
- [ ] Empty state with explanatory message
- [ ] Below-threshold state with progress (e.g., "2 of 3 conversations needed")
- [ ] Stale indicator when >30 days old
- [ ] Manual refresh button with rate-limit feedback

---

### Task 5.3: Dashboard Integration — Seeker

**Status:** 🔴 Blocked by 5.2
**Effort:** 0.75 hours
**Dependencies:** Task 5.2

**Description:**
Add the InsightsPanel to the seeker dashboard page, wired to `insights.getSeekerInsights`.

**File:** `src/app/(seeker)/dashboard/page.tsx` (modify) or new section component

**Acceptance Criteria:**

- [ ] InsightsPanel renders in seeker dashboard
- [ ] Calls `getSeekerInsights` tRPC procedure
- [ ] Refresh button calls `refreshInsights`
- [ ] Gracefully handles feature flag off (section hidden)

---

### Task 5.4: Dashboard Integration — Employer

**Status:** 🔴 Blocked by 5.2
**Effort:** 0.75 hours
**Dependencies:** Task 5.2
**Parallel with:** Task 5.3

**Description:**
Add the InsightsPanel to the employer dashboard page, wired to `insights.getEmployerInsights`.

**File:** `src/app/(employer)/dashboard/page.tsx` (modify) or new section component

**Acceptance Criteria:**

- [ ] InsightsPanel renders in employer dashboard
- [ ] Calls `getEmployerInsights` tRPC procedure
- [ ] Optional posting selector to scope insights
- [ ] Refresh button calls `refreshInsights`
- [ ] Gracefully handles feature flag off (section hidden)

---

## Phase 6: Integration & Quality

### Task 6.1: Privacy Boundary Test Suite

**Status:** 🔴 Blocked by 3.2
**Effort:** 1.5 hours
**Dependencies:** Task 3.2

**Description:**
Dedicated test suite that verifies the privacy boundary is enforced end-to-end. Tests the full pipeline from raw data to LLM prompt to stored output.

**File:** `src/server/insights/privacy-boundary.test.ts`

**Acceptance Criteria:**

- [ ] Verify aggregation output contains no user names
- [ ] Verify aggregation output contains no conversation message text
- [ ] Verify aggregation output contains no salary/deal-breaker values
- [ ] Verify aggregation output contains no employer/company identifiers
- [ ] Verify LLM prompt construction contains only aggregate data
- [ ] Verify stored insights contain no PII (spot-check generated output)

**User Stories:** US-4, FR-6

---

### Task 6.2: Edge Case Test Suite

**Status:** 🔴 Blocked by 3.2, 4.2
**Effort:** 1 hour
**Dependencies:** Tasks 3.2, 4.2

**Description:**
Test all documented edge cases from the spec.

**File:** `src/server/insights/edge-cases.test.ts`

**Acceptance Criteria:**

- [ ] EC-1: All no-match conversations produce constructive insights
- [ ] EC-2: Invalid BYOK key returns metrics-only (no crash)
- [ ] EC-3: Malformed LLM output retried 3x, existing insights preserved on failure
- [ ] EC-4: Concurrent regeneration deduplicated via upsert
- [ ] EC-5: Deleted user mid-generation terminates cleanly
- [ ] EC-6: High-volume user bounded to last 50 conversations
- [ ] EC-7: Single-posting employer gets posting-level insights

---

### Task 6.3: Code Review

**Status:** 🔴 Blocked by all implementation tasks
**Effort:** 1 hour
**Dependencies:** Tasks 2.4, 2.6, 3.2, 3.4, 3.5, 4.2, 5.2, 5.3, 5.4

**Description:**
Run `/code-review` on all changed files. Address CRITICAL and HIGH issues.

**Acceptance Criteria:**

- [ ] All CRITICAL issues resolved
- [ ] All HIGH issues resolved
- [ ] No security vulnerabilities
- [ ] Code follows project conventions

---

### Task 6.4: Security Review

**Status:** 🔴 Blocked by 6.3
**Effort:** 0.5 hours
**Dependencies:** Task 6.3

**Description:**
Run `/security-review` focusing on privacy boundary, BYOK key handling, and authorization.

**Acceptance Criteria:**

- [ ] Privacy boundary enforced at data layer (not just prompt)
- [ ] BYOK key decrypted only in Inngest step, never logged
- [ ] All endpoints enforce user authorization
- [ ] No PII in error messages or logs
- [ ] Rate limiting prevents BYOK key abuse

---

### Task 6.5: Full Test Suite Validation

**Status:** 🔴 Blocked by 6.4
**Effort:** 0.5 hours
**Dependencies:** Task 6.4

**Description:**
Run complete test suite to verify no regressions.

**Acceptance Criteria:**

- [ ] All existing tests still pass
- [ ] All new Feature 14 tests pass
- [ ] Zero TypeScript errors
- [ ] ESLint passes with zero warnings

---

## Dependency Graph

```
Phase 1 (parallel):
  1.1 Schema ─────────────────┐
  1.2 Flag ──────────────────┐│
                              ││
Phase 2 (core logic):        ││
  2.1 Schemas Tests ◄────────┘│
  2.2 Schemas Impl ◄── 2.1   │
  2.3 Aggregate Tests ◄── 2.2│
  2.4 Aggregate Impl ◄── 2.3 │
  2.5 LLM Gen Tests ◄── 2.2  │  (parallel with 2.3)
  2.6 LLM Gen Impl ◄── 2.5   │
                              │
Phase 3 (Inngest):            │
  3.1 Gen Function Tests ◄── 2.4 + 2.6
  3.2 Gen Function Impl ◄── 3.1
  3.3 Threshold Tests ◄──────┘  (parallel with 2.1)
  3.4 Threshold Impl ◄── 3.3
  3.5 Event Emission ◄── 3.4

Phase 4 (API):
  4.1 Router Tests ◄── 2.4
  4.2 Router Impl ◄── 4.1

Phase 5 (UI):
  5.1 Panel Tests ◄── 4.2
  5.2 Panel Impl ◄── 5.1
  5.3 Seeker Dashboard ◄── 5.2
  5.4 Employer Dashboard ◄── 5.2  (parallel with 5.3)

Phase 6 (quality):
  6.1 Privacy Tests ◄── 3.2
  6.2 Edge Case Tests ◄── 3.2 + 4.2
  6.3 Code Review ◄── all impl tasks
  6.4 Security Review ◄── 6.3
  6.5 Full Test Suite ◄── 6.4
```

## Critical Path

```
1.1 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 6.1 → 6.3 → 6.4 → 6.5
```

**Critical path effort:** ~15 hours

## Parallelization Opportunities

- **1.1 and 1.2** — schema and flag independent
- **2.3/2.4 and 2.5/2.6** — aggregation and LLM generation independent (both depend on 2.2)
- **3.3/3.4 and 2.1+** — threshold check depends only on schema (1.1)
- **4.1/4.2 and 3.1/3.2** — router tests depend on aggregation (2.4), not on Inngest
- **5.3 and 5.4** — seeker and employer dashboard integration independent
- **6.1 and 6.2** — privacy and edge case suites independent

## User Story → Task Mapping

| User Story                     | Tasks                              |
| ------------------------------ | ---------------------------------- |
| US-1: Seeker Views Insights    | 2.3-2.6, 4.1-4.2, 5.1-5.3          |
| US-2: Employer Views Insights  | 2.3-2.6, 4.1-4.2, 5.1-5.2, 5.4     |
| US-3: Insights Regeneration    | 3.1-3.5, 4.1-4.2 (refreshInsights) |
| US-4: Privacy-Safe Aggregation | 2.3-2.4, 6.1                       |
| US-5: Empty State              | 4.1-4.2, 5.1-5.2                   |
