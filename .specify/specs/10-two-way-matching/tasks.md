# Task Breakdown: Two-Way Matching

**Feature:** 10-two-way-matching
**Plan:** `.specify/specs/10-two-way-matching/plan.md`
**Created:** 2026-03-07

---

## Phase 1: Schema & Types (Foundation)

### Task 1.1: Evaluation Zod Schemas — Tests

**Status:** 🟡 Ready
**Dependencies:** None
**User Stories:** US-1, US-3 (FR-009, FR-011)

**Description:**
Write tests for the new evaluation Zod schemas: `agentDimensionScoreSchema`, `agentEvaluationSchema`, `matchEvaluationDataSchema`. Also test the extended `agentTurnOutputSchema` — evaluation required when decision is MATCH/NO_MATCH, optional when CONTINUE. **TESTS FIRST.**

**Files:**

- `tests/unit/lib/evaluation-schemas.test.ts` (new)

**Acceptance Criteria:**

- [ ] Valid AgentDimensionScore passes validation (all 6 dimension names)
- [ ] Invalid dimension name rejected
- [ ] Score boundaries validated (0-100)
- [ ] Valid AgentEvaluation with 4-6 dimensions passes
- [ ] AgentEvaluation with <4 dimensions rejected
- [ ] Extended AgentTurnOutput: decision=MATCH without evaluation fails
- [ ] Extended AgentTurnOutput: decision=CONTINUE without evaluation passes
- [ ] MatchEvaluationData validates combined evaluations + confidenceInputs
- [ ] All tests FAIL (no implementation yet)

---

### Task 1.2: computeConfidence() — Tests

**Status:** 🟡 Ready
**Dependencies:** None
**Parallel with:** Task 1.1
**User Stories:** US-3 (FR-004, FR-011)

**Description:**
Write tests for the `computeConfidence()` pure function. Cover all tier boundaries and edge cases. **TESTS FIRST.**

**Files:**

- `tests/unit/lib/compute-confidence.test.ts` (new)

**Acceptance Criteria:**

- [ ] Average score >= 75 returns STRONG
- [ ] Average score 55-74 returns GOOD
- [ ] Average score 35-54 returns POTENTIAL
- [ ] Exact boundary values tested (75, 55, 35)
- [ ] Determinism: same input always returns same output
- [ ] confidenceInputs computed correctly (averageScore, weakestDimension, weakestScore, dimensionCount)
- [ ] All tests FAIL

---

### Task 1.3: Evaluation Schemas — Implementation

**Status:** 🔴 Blocked
**Dependencies:** Task 1.1
**User Stories:** US-1, US-3 (FR-009, FR-010)

**Description:**
Implement the evaluation Zod schemas in `src/lib/conversation-schemas.ts` and extend `agentTurnOutputSchema`. Use `.refine()` to enforce evaluation presence on decision turns.

**Files:**

- `src/lib/conversation-schemas.ts` (modify)

**Acceptance Criteria:**

- [ ] `agentDimensionScoreSchema` with enum of 6 dimension names
- [ ] `agentEvaluationSchema` with role, overallScore, recommendation, reasoning, dimensions
- [ ] `agentTurnOutputSchema` extended with optional `evaluation` field
- [ ] Refinement: evaluation required when decision !== "CONTINUE"
- [ ] All Task 1.1 tests PASS

---

### Task 1.4: computeConfidence() — Implementation

**Status:** 🔴 Blocked
**Dependencies:** Task 1.2, Task 1.3
**User Stories:** US-3 (FR-004, FR-011)

**Description:**
Implement `computeConfidence()` and `matchEvaluationDataSchema` in `src/lib/matching-schemas.ts`.

**Files:**

- `src/lib/matching-schemas.ts` (modify)

**Acceptance Criteria:**

- [ ] `computeConfidence()` accepts employer + seeker evaluations, returns `{ confidence, confidenceInputs }`
- [ ] `matchEvaluationDataSchema` validates the combined structure
- [ ] All Task 1.2 tests PASS

---

### Task 1.5: Prisma Migration

**Status:** 🟡 Ready
**Dependencies:** None
**Parallel with:** Tasks 1.1-1.4

**Description:**
Add nullable fields to Match model in Prisma schema and run migration.

**Files:**

- `prisma/schema.prisma` (modify)

**Acceptance Criteria:**

- [ ] `employerSummary String?` added to Match
- [ ] `seekerSummary String?` added to Match
- [ ] `evaluationData Json?` added to Match
- [ ] Migration runs successfully
- [ ] Existing Match records unaffected (null values for new fields)

---

## Phase 2: Agent Enhancement

### Task 2.1: Seeker Agent Evaluation — Tests

**Status:** 🔴 Blocked
**Dependencies:** Task 1.3
**User Stories:** US-1 (FR-002, FR-003)

**Description:**
Write tests for the enhanced seeker agent. Test that it produces structured evaluations on decision turns, respects deal-breakers, and weights by priority ranking. **TESTS FIRST.** LLM calls mocked.

**Files:**

- `tests/unit/server/agents/seeker-agent-evaluation.test.ts` (new)

**Acceptance Criteria:**

- [ ] Seeker agent returns evaluation with dimension scores on MATCH decision
- [ ] Seeker agent returns evaluation with dimension scores on NO_MATCH decision
- [ ] Seeker agent signals NO_MATCH when deal-breaker triggered (on-site vs remote-only)
- [ ] Seeker agent signals NO_MATCH when salary below minimum
- [ ] Seeker agent returns CONTINUE without evaluation on non-decision turns
- [ ] Evaluation reasoning does not contain exact private parameter values
- [ ] All tests FAIL

---

### Task 2.2: Employer Agent Evaluation — Tests

**Status:** 🔴 Blocked
**Dependencies:** Task 1.3
**Parallel with:** Task 2.1
**User Stories:** US-2 (FR-009)

**Description:**
Write tests for the enhanced employer agent. Test that it produces structured evaluations on decision turns. **TESTS FIRST.** LLM calls mocked.

**Files:**

- `tests/unit/server/agents/employer-agent-evaluation.test.ts` (new)

**Acceptance Criteria:**

- [ ] Employer agent returns evaluation with dimension scores on MATCH decision
- [ ] Employer agent returns evaluation with dimension scores on NO_MATCH decision
- [ ] Employer agent returns CONTINUE without evaluation on non-decision turns
- [ ] Evaluation dimensions include skills_alignment, experience_fit, culture_fit, growth_potential
- [ ] All tests FAIL

---

### Task 2.3: Seeker Agent — Implementation

**Status:** 🔴 Blocked
**Dependencies:** Task 2.1
**User Stories:** US-1 (FR-002, FR-003)

**Description:**
Enhance seeker agent system prompt and schema to produce structured evaluations on decision turns. Add instructions for proactive preference evaluation and deal-breaker detection.

**Files:**

- `src/server/agents/seeker-agent.ts` (modify)

**Acceptance Criteria:**

- [ ] System prompt updated with evaluation instructions for decision phase
- [ ] Agent uses extended `agentTurnOutputSchema` (with evaluation)
- [ ] Prompt instructs agent to check compensation against minSalary qualitatively
- [ ] Prompt instructs agent to check deal-breakers and signal NO_MATCH if violated
- [ ] Prompt instructs agent to weight evaluation by priority ranking
- [ ] All Task 2.1 tests PASS

---

### Task 2.4: Employer Agent — Implementation

**Status:** 🔴 Blocked
**Dependencies:** Task 2.2
**Parallel with:** Task 2.3
**User Stories:** US-2 (FR-009)

**Description:**
Enhance employer agent system prompt and schema to produce structured evaluations on decision turns.

**Files:**

- `src/server/agents/employer-agent.ts` (modify)

**Acceptance Criteria:**

- [ ] System prompt updated with evaluation instructions for decision phase
- [ ] Agent uses extended `agentTurnOutputSchema` (with evaluation)
- [ ] Prompt instructs agent to score candidate on all 6 dimensions
- [ ] All Task 2.2 tests PASS

---

## Phase 3: Match Creation Upgrade

### Task 3.1: Match Creation with Evaluations — Tests

**Status:** 🔴 Blocked
**Dependencies:** Tasks 1.3, 1.4, 1.5
**User Stories:** US-2, US-3, US-4 (FR-001, FR-004, FR-005)

**Description:**
Write integration tests for the upgraded match creation logic in the finalize step. Test evaluation extraction, confidence computation, and summary generation. **TESTS FIRST.**

**Files:**

- `tests/unit/server/inngest/match-creation.test.ts` (new)

**Acceptance Criteria:**

- [ ] Match created only when both agents signal MATCH (FR-001)
- [ ] Match.evaluationData contains both agent evaluations
- [ ] Match.confidenceScore derived from dimension averages (not message count)
- [ ] Match.employerSummary extracted from employer evaluation reasoning
- [ ] Match.seekerSummary extracted from seeker evaluation reasoning
- [ ] No Match created when either agent signals NO_MATCH
- [ ] Fallback: if evaluation missing, match still created with null evaluationData
- [ ] All tests FAIL

---

### Task 3.2: Match Creation — Implementation

**Status:** 🔴 Blocked
**Dependencies:** Task 3.1, Tasks 2.3, 2.4
**User Stories:** US-2, US-3, US-4 (FR-001, FR-004, FR-005)

**Description:**
Upgrade the finalize step in `run-agent-conversation.ts`. Replace message-count confidence with evaluation-based confidence. Extract per-perspective summaries.

**Files:**

- `src/server/inngest/functions/run-agent-conversation.ts` (modify)

**Acceptance Criteria:**

- [ ] Extract evaluation from last employer_agent decision message
- [ ] Extract evaluation from last seeker_agent decision message
- [ ] Call `computeConfidence()` with both evaluations
- [ ] Populate `employerSummary`, `seekerSummary`, `evaluationData` on Match
- [ ] Remove old message-count confidence logic
- [ ] Graceful fallback if evaluation missing (null evaluationData, use old confidence)
- [ ] All Task 3.1 tests PASS

---

## Phase 4: Dashboard & Privacy

### Task 4.1: No-Match Dashboard Filtering — Tests

**Status:** 🔴 Blocked
**Dependencies:** Task 1.5
**Parallel with:** Phase 2, Phase 3
**User Stories:** US-5 (FR-007, FR-008)

**Description:**
Write tests verifying no-match conversations don't appear in dashboard queries. Test both seeker and employer views. **TESTS FIRST.**

**Files:**

- `tests/unit/server/api/routers/matches-no-match.test.ts` (new)

**Acceptance Criteria:**

- [ ] Seeker dashboard query returns no results for COMPLETED_NO_MATCH conversations
- [ ] Employer candidate list excludes seekers with only no-match conversations
- [ ] No notifications sent for no-match conversations
- [ ] Match detail view handles null evaluationData gracefully (old matches)
- [ ] All tests FAIL

---

### Task 4.2: No-Match Dashboard Filtering — Implementation

**Status:** 🔴 Blocked
**Dependencies:** Task 4.1
**User Stories:** US-5 (FR-007, FR-008)

**Description:**
Verify and update match router queries. Ensure no-match conversations are invisible. Handle null evaluationData for backwards compatibility.

**Files:**

- `src/server/api/routers/matches.ts` (modify if needed)

**Acceptance Criteria:**

- [ ] Verified: no Match record exists for no-match conversations (by design)
- [ ] Any employer candidate listing filters by match existence
- [ ] Match detail view conditionally renders evaluation data (null-safe)
- [ ] All Task 4.1 tests PASS

---

### Task 4.3: Privacy Filter for Evaluations — Tests

**Status:** 🔴 Blocked
**Dependencies:** Task 1.3
**Parallel with:** Tasks 4.1, Phase 3
**User Stories:** US-4 (FR-006)

**Description:**
Write tests verifying privacy filter applies to evaluation reasoning text and match summaries. **TESTS FIRST.**

**Files:**

- `tests/unit/server/agents/privacy-filter-evaluations.test.ts` (new)

**Acceptance Criteria:**

- [ ] Evaluation reasoning with salary figures gets filtered
- [ ] Evaluation reasoning with deal-breaker text gets filtered
- [ ] Evaluation reasoning with exclusion company names gets filtered
- [ ] Match summaries derived from filtered reasoning contain no private values
- [ ] All tests FAIL

---

### Task 4.4: Privacy Filter for Evaluations — Implementation

**Status:** 🔴 Blocked
**Dependencies:** Task 4.3
**User Stories:** US-4 (FR-006)

**Description:**
Extend privacy filter to run on evaluation reasoning fields before storage. Ensure match summaries are derived from already-filtered text.

**Files:**

- `src/server/agents/privacy-filter.ts` (modify)
- `src/server/inngest/functions/run-agent-conversation.ts` (modify — apply filter to evaluation)

**Acceptance Criteria:**

- [ ] `filterPrivateValues()` applied to evaluation reasoning text
- [ ] `filterPrivateValues()` applied to dimension-level reasoning
- [ ] Match summaries sourced from post-filter evaluation reasoning
- [ ] All Task 4.3 tests PASS

---

## Phase 5: Integration Testing & Quality Gates

### Task 5.1: End-to-End Conversation Integration Tests

**Status:** 🔴 Blocked
**Dependencies:** Tasks 3.2, 4.2, 4.4
**User Stories:** All (US-1 through US-5)

**Description:**
Write integration tests running full conversation scenarios through the Inngest function with mocked LLM calls. Cover mutual match, seeker no-match, employer no-match, and deal-breaker early exit.

**Files:**

- `tests/integration/two-way-matching.test.ts` (new)

**Acceptance Criteria:**

- [ ] Mutual MATCH: both agents produce evaluations, Match created with evaluationData, confidence, summaries
- [ ] Seeker NO_MATCH (deal-breaker): no Match created, conversation COMPLETED_NO_MATCH, no notifications
- [ ] Employer NO_MATCH: no Match created, silent termination
- [ ] Max turns without consensus: COMPLETED_NO_MATCH
- [ ] Empty seeker private settings: match still works with null-safe evaluation
- [ ] Backwards compatibility: Feature 9 conversations without evaluations still work

---

### Task 5.2: Code Review

**Status:** 🔴 Blocked
**Dependencies:** Task 5.1

**Description:**
Run code review on all modified files. Check for type safety, privacy compliance, and constitutional adherence.

**Acceptance Criteria:**

- [ ] No `any` types introduced
- [ ] All Zod schemas cover edge cases
- [ ] Privacy filter coverage complete
- [ ] No private values in stored data
- [ ] Code follows existing patterns

---

### Task 5.3: Security Review

**Status:** 🔴 Blocked
**Dependencies:** Task 5.1
**Parallel with:** Task 5.2

**Description:**
Run `/security-review` on modified agent, privacy filter, and match creation files.

**Acceptance Criteria:**

- [ ] No private parameter leakage paths
- [ ] No cross-tenant data access
- [ ] Evaluation data validated before storage
- [ ] OWASP Top 10 check passed

---

## Summary

| Phase                  | Tasks   | Description                                       |
| ---------------------- | ------- | ------------------------------------------------- |
| 1. Schema & Types      | 1.1-1.5 | Zod schemas, computeConfidence, Prisma migration  |
| 2. Agent Enhancement   | 2.1-2.4 | Seeker + employer agent structured evaluations    |
| 3. Match Creation      | 3.1-3.2 | Finalize step upgrade with evaluation data        |
| 4. Dashboard & Privacy | 4.1-4.4 | No-match filtering, privacy filter on evaluations |
| 5. Integration & QA    | 5.1-5.3 | E2E tests, code review, security review           |

**Total Tasks:** 17
**Test Tasks:** 8 (TDD enforced)
**Implementation Tasks:** 7
**Quality Gate Tasks:** 2

### Parallelization Opportunities

- Tasks 1.1 + 1.2 + 1.5 (all ready, no dependencies)
- Tasks 2.1 + 2.2 (both blocked on 1.3 only)
- Tasks 2.3 + 2.4 (independent agent implementations)
- Tasks 4.1 + 4.3 (independent test suites)
- Tasks 5.2 + 5.3 (code review + security review)

### Critical Path

```
1.1 → 1.3 → 2.1 → 2.3 → 3.2 → 5.1 → 5.2
```

### User Story → Task Mapping

| User Story                    | Tasks                        |
| ----------------------------- | ---------------------------- |
| US-1: Seeker Agent Evaluates  | 1.1, 1.3, 2.1, 2.3           |
| US-2: Bidirectional Consensus | 1.1, 1.3, 2.2, 2.4, 3.1, 3.2 |
| US-3: Confidence Scoring      | 1.2, 1.4                     |
| US-4: Both-Sided Summary      | 3.1, 3.2, 4.3, 4.4           |
| US-5: Silent No-Match         | 4.1, 4.2                     |
