# Task Breakdown: Agent-to-Agent Conversations

**Feature:** 9-agent-to-agent-conversations
**Plan:** plan.md
**Created:** 2026-03-06

---

## Phase 1: Foundation — Schemas, Privacy Filter, Feature Flag

### Task 1.1: Conversation Schemas — Tests + Implementation

**Status:** ✅ Complete
**Effort:** 2h
**Dependencies:** None
**Parallel with:** Task 1.2, Task 1.3

**Description:**
Create `src/lib/conversation-schemas.ts` with Zod schemas for conversation messages, turn output, decisions, and context. TDD: write schema parse/reject tests first.

**Acceptance Criteria:**

- [ ] Tests for valid message parsing (all phases, both roles)
- [ ] Tests for invalid message rejection (missing fields, out-of-range turnNumber, content too long)
- [ ] Tests for decision enum validation
- [ ] Tests confirmed to FAIL before implementation
- [ ] All schemas implemented and tests PASS
- [ ] Types exported for use by agents and orchestrator

**Files:**

- `src/lib/conversation-schemas.ts`
- `src/lib/conversation-schemas.test.ts`

---

### Task 1.2: Privacy Filter — Tests + Implementation

**Status:** ✅ Complete
**Effort:** 3h
**Dependencies:** None
**Parallel with:** Task 1.1, Task 1.3

**Description:**
Create `src/server/agents/privacy-filter.ts` that strips exact private parameter values from agent output text. TDD: write tests with known private values first.

**Acceptance Criteria:**

- [ ] Tests: exact salary numbers removed from text (e.g., "$85,000" → "[REDACTED]" when minSalary=85000)
- [ ] Tests: non-matching numbers preserved (general numbers not in private params)
- [ ] Tests: deal-breaker strings redacted when they appear verbatim
- [ ] Tests: content with no private values passes through unchanged
- [ ] Tests: edge cases (null values, empty arrays, currency formatting variants)
- [ ] Tests confirmed to FAIL before implementation
- [ ] Filter implemented and tests PASS

**Files:**

- `src/server/agents/privacy-filter.ts`
- `src/server/agents/privacy-filter.test.ts`

---

### Task 1.3: Feature Flag + Seeker Agent — Tests + Implementation

**Status:** ✅ Complete
**Effort:** 3h
**Dependencies:** None
**Parallel with:** Task 1.1, Task 1.2

**Description:**
Add `AGENT_CONVERSATIONS` feature flag to `src/lib/flags.ts`. Create `src/server/agents/seeker-agent.ts` — the Job Seeker Agent that evaluates opportunities from the seeker's perspective using their BYOK key. Follow the pattern established by `employer-agent.ts`. TDD.

**Acceptance Criteria:**

- [ ] `AGENT_CONVERSATIONS` flag added, defaults to false
- [ ] Flag default test added to `tests/unit/lib/flags.test.ts`
- [ ] Seeker agent tests: prompt builder includes seeker profile and private settings context
- [ ] Seeker agent tests: prompt builder does NOT include raw private param values in the user-visible prompt section
- [ ] Seeker agent tests: `evaluateOpportunity()` returns validated `AgentTurnOutput` via mocked `generateObject`
- [ ] Seeker agent tests: returns null on LLM failure
- [ ] Seeker agent tests: anti-discrimination guardrails in system prompt
- [ ] Tests confirmed to FAIL before implementation
- [ ] Seeker agent implemented, tests PASS

**Files:**

- `src/lib/flags.ts` (modify)
- `src/server/agents/seeker-agent.ts`
- `src/server/agents/seeker-agent.test.ts`
- `tests/unit/lib/flags.test.ts` (modify)

---

## Phase 2: Conversation Orchestrator

### Task 2.1: Orchestrator — Tests

**Status:** ✅ Complete
**Effort:** 4h
**Dependencies:** Task 1.1, 1.2, 1.3

**Description:**
Write comprehensive tests for `src/server/agents/conversation-orchestrator.ts`. Mock both agents and the privacy filter. Cover all conversation flows. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests: full conversation flow — discovery through match decision (happy path, both MATCH)
- [ ] Tests: no-match path — one agent signals NO_MATCH after min turns
- [ ] Tests: max turns reached without decision → COMPLETED_NO_MATCH
- [ ] Tests: phase progression (discovery → screening → deep_evaluation → negotiation → decision)
- [ ] Tests: minimum turns enforced (decision before min turns rejected, forced CONTINUE)
- [ ] Tests: privacy filter applied to every message before storage
- [ ] Tests: guardrail violation detection → TERMINATED
- [ ] Tests: both agents signal NO_MATCH simultaneously
- [ ] Tests: one agent signals MATCH, other signals NO_MATCH → COMPLETED_NO_MATCH
- [ ] All tests confirmed to FAIL

**Files:**

- `src/server/agents/conversation-orchestrator.test.ts`

---

### Task 2.2: Orchestrator — Implementation

**Status:** ✅ Complete
**Effort:** 4h
**Dependencies:** Task 2.1

**Description:**
Implement `src/server/agents/conversation-orchestrator.ts` to pass all tests from Task 2.1. The orchestrator manages turn-taking between employer and seeker agents, tracks phases, evaluates termination conditions, and applies the privacy filter.

**Acceptance Criteria:**

- [ ] All tests from 2.1 PASS
- [ ] Orchestrator accepts conversation context and returns ConversationResult
- [ ] Turn alternation: employer → seeker → employer → ...
- [ ] Phase tracked and progressed based on turn count and agent signals
- [ ] Privacy filter applied to each agent's output before adding to messages array
- [ ] Match record data prepared on mutual MATCH (summary, confidence)
- [ ] No BYOK keys stored in any return value or message

**Files:**

- `src/server/agents/conversation-orchestrator.ts`

---

## Phase 3: Inngest Workflow

### Task 3.1: run-agent-conversation Workflow — Tests

**Status:** ✅ Complete
**Effort:** 3h
**Dependencies:** Task 2.2

**Description:**
Write tests for the `run-agent-conversation` Inngest function. Mock the orchestrator, database calls, and BYOK key decryption. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests: workflow creates AgentConversation record with IN_PROGRESS status
- [ ] Tests: workflow stores inngestRunId on the conversation
- [ ] Tests: workflow calls orchestrator and persists messages after each turn
- [ ] Tests: on COMPLETED_MATCH, creates Match record with correct conversationId
- [ ] Tests: on COMPLETED_NO_MATCH, updates conversation status (no Match created)
- [ ] Tests: on TERMINATED, updates conversation status with reason
- [ ] Tests: duplicate prevention — skips if IN_PROGRESS conversation exists for seeker+posting
- [ ] Tests: missing BYOK key for either party → skip with appropriate status
- [ ] All tests confirmed to FAIL

**Files:**

- `src/server/inngest/functions/run-agent-conversation.test.ts`

---

### Task 3.2: run-agent-conversation Workflow — Implementation

**Status:** ✅ Complete
**Effort:** 4h
**Dependencies:** Task 3.1

**Description:**
Implement the `run-agent-conversation` Inngest function. One step per turn for resumability. Register in the function index.

**Acceptance Criteria:**

- [ ] All tests from 3.1 PASS
- [ ] Function registered in `src/server/inngest/functions/index.ts`
- [ ] Triggered by `conversations/start` event
- [ ] Step 1 (`load-context`): fetches posting, seeker profile, private settings for both sides, decrypts BYOK keys
- [ ] Steps 2–N (`turn-{n}`): calls orchestrator for one turn, persists messages to DB
- [ ] Final step: updates conversation status, creates Match if applicable
- [ ] Concurrency limited to 50 per jobPostingId via Inngest concurrency config
- [ ] Retries: 3 per step

**Files:**

- `src/server/inngest/functions/run-agent-conversation.ts`
- `src/server/inngest/functions/index.ts` (modify)

---

## Phase 4: Feature 5 Integration

### Task 4.1: evaluate-candidates Modification — Tests

**Status:** ✅ Complete
**Effort:** 2h
**Dependencies:** Task 3.2

**Description:**
Update tests for `evaluate-candidates` to cover the new AGENT_CONVERSATIONS flag branching. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests: when AGENT_CONVERSATIONS flag OFF, existing behavior unchanged (direct match creation)
- [ ] Tests: when AGENT_CONVERSATIONS flag ON, dispatches `conversations/start` events instead of creating direct matches
- [ ] Tests: dispatched events contain correct jobPostingId, seekerId, employerId
- [ ] Tests: only candidates above threshold get conversation events
- [ ] Tests: candidates already with IN_PROGRESS conversations are skipped
- [ ] All tests confirmed to FAIL (new flag-ON tests)

**Files:**

- `src/server/inngest/functions/evaluate-candidates.test.ts` (modify)

---

### Task 4.2: evaluate-candidates Modification — Implementation

**Status:** ✅ Complete
**Effort:** 2h
**Dependencies:** Task 4.1

**Description:**
Modify `evaluate-candidates` to check the `AGENT_CONVERSATIONS` flag. When ON, send `conversations/start` events for above-threshold candidates. When OFF, preserve existing direct match creation.

**Acceptance Criteria:**

- [ ] All tests from 4.1 PASS
- [ ] All existing evaluate-candidates tests still PASS
- [ ] Flag check uses `assertFlagEnabled` pattern (try/catch to determine state)
- [ ] Event dispatch uses `step.sendEvent()` for Inngest integration
- [ ] No changes to scoring logic — threshold and evaluation unchanged

**Files:**

- `src/server/inngest/functions/evaluate-candidates.ts` (modify)

---

## Phase 5: Hardening & Quality

### Task 5.1: Edge Case Tests + Privacy Audit

**Status:** ✅ Complete
**Effort:** 3h
**Dependencies:** Task 4.2
**Parallel with:** Task 5.2

**Description:**
Comprehensive edge case testing and privacy validation across the full conversation pipeline.

**Acceptance Criteria:**

- [ ] Test: BYOK key becomes invalid mid-conversation → conversation paused
- [ ] Test: job posting deactivated mid-conversation → TERMINATED
- [ ] Test: concurrent conversation limit (50) enforced
- [ ] Test: maximum turn limit reached → COMPLETED_NO_MATCH
- [ ] Test: agent produces guardrail-violating output → retry once, then TERMINATED
- [ ] Privacy audit: grep all conversation-related files for private field names; verify no raw values leak
- [ ] All edge case tests PASS

**Files:**

- `src/server/agents/conversation-orchestrator.test.ts` (extend)
- `src/server/inngest/functions/run-agent-conversation.test.ts` (extend)

---

### Task 5.2: E2E Test Stubs + Security Review

**Status:** ✅ Complete
**Effort:** 2h
**Dependencies:** Task 4.2
**Parallel with:** Task 5.1

**Description:**
Create E2E test stubs for the conversation flow (gated behind PLAYWRIGHT_E2E_ENABLED). Run security review on all new agent and privacy code.

**Acceptance Criteria:**

- [ ] E2E stub: conversation initiated on posting activation (mocked agents)
- [ ] E2E stub: match appears in dashboard after conversation completes
- [ ] Security review: no BYOK keys in logs, events, or messages
- [ ] Security review: no private param values in stored conversation messages
- [ ] Security review: no cross-tenant data access possible
- [ ] All new files pass TypeScript strict mode compilation

**Files:**

- `tests/e2e/agent-conversations.spec.ts`

---

### Task 5.3: Task Completion & Cleanup

**Status:** ✅ Complete
**Effort:** 1h
**Dependencies:** Task 5.1, 5.2

**Description:**
Final verification: run full test suite, verify no regressions, update tasks.md status.

**Acceptance Criteria:**

- [ ] `pnpm test` — all unit tests pass
- [ ] `pnpm build` — zero TypeScript errors
- [ ] No console.log statements in new files
- [ ] All tasks in this file marked complete
- [ ] Ready for commit

---

## User Story → Task Mapping

| User Story                           | Tasks                                                         |
| ------------------------------------ | ------------------------------------------------------------- |
| US1: Employer Initiates Conversation | 4.1, 4.2 (evaluate-candidates dispatches conversations)       |
| US2: Multi-Turn Dialogue             | 1.1, 2.1, 2.2 (schemas + orchestrator)                        |
| US3: Private Parameter Protection    | 1.2, 2.1, 2.2, 5.1 (privacy filter + audit)                   |
| US4: No-Match Quiet Termination      | 2.1, 2.2, 3.1, 3.2 (orchestrator + workflow)                  |
| US5: Conversation Produces Match     | 2.1, 2.2, 3.1, 3.2 (orchestrator + workflow)                  |
| US6: Guardrail Enforcement           | 1.3, 2.1, 2.2, 5.1 (seeker agent + orchestrator + edge cases) |
| US7: Conversation Resilience         | 3.1, 3.2, 5.1 (Inngest workflow + edge cases)                 |

---

## Critical Path

```
1.1 ──┐
1.2 ──┤→ 2.1 → 2.2 → 3.1 → 3.2 → 4.1 → 4.2 → 5.1 ──┐→ 5.3
1.3 ──┘                                        5.2 ──┘
```

**Critical path duration:** ~28h (Tasks 1.x parallel: 3h → 2.1: 4h → 2.2: 4h → 3.1: 3h → 3.2: 4h → 4.1: 2h → 4.2: 2h → 5.x parallel: 3h → 5.3: 1h)

---

## Summary

| Phase                    | Tasks  | Effort  |
| ------------------------ | ------ | ------- |
| 1. Foundation            | 3      | 8h      |
| 2. Orchestrator          | 2      | 8h      |
| 3. Inngest Workflow      | 2      | 7h      |
| 4. Feature 5 Integration | 2      | 4h      |
| 5. Hardening             | 3      | 6h      |
| **Total**                | **12** | **33h** |

### Parallelization Opportunities

- Phase 1: Tasks 1.1, 1.2, 1.3 all parallel (no dependencies)
- Phase 5: Tasks 5.1, 5.2 parallel (independent concerns)

### Quality Gates

- [x] TDD enforced (tests before implementation in all phases)
- [x] Security review in Task 5.2
- [x] Privacy audit in Task 5.1
- [x] E2E stubs in Task 5.2
- [x] Full regression check in Task 5.3
