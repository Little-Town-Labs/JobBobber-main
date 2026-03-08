# Task Breakdown — Feature 15: Custom Agent Prompting

**Branch:** 15-custom-agent-prompting
**Plan:** `.specify/specs/15-custom-agent-prompting/plan.md`
**Status:** Ready for implementation

---

## Phase 1: Foundation (Prompt Guard + Feature Flag)

### Task 1.1: Feature Flag + Prompt Guard — Tests

**Status:** 🟡 Ready
**Effort:** 1.5 hours
**Dependencies:** None

**Description:**
Write tests for the `CUSTOM_PROMPTS` feature flag and the `prompt-guard.ts` injection detection module. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Test `CUSTOM_PROMPTS` flag exists and defaults to OFF
- [ ] Test `validateCustomPrompt()` rejects role override patterns ("ignore previous instructions", "you are now", "new instructions:")
- [ ] Test rejects system prompt extraction patterns ("repeat your system prompt", "what are your instructions")
- [ ] Test rejects delimiter injection patterns (closing XML tags, `</user-customization>`, `</system>`)
- [ ] Test rejects override patterns ("disregard all prior", "override all rules", "forget everything")
- [ ] Test accepts legitimate prompts ("Be assertive on salary", "Prioritize culture fit")
- [ ] Test accepts edge cases: empty string, max length (2000 chars), unicode, emoji
- [ ] Test returns user-friendly reason on rejection (no internal pattern details exposed)
- [ ] Test whitespace-only prompts treated as empty (valid, returns valid: true)
- [ ] Tests confirmed to FAIL

**Files:**

- `src/server/agents/prompt-guard.test.ts`

---

### Task 1.2: Feature Flag + Prompt Guard — Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 1.5 hours
**Dependencies:** Task 1.1

**Description:**
Add the `CUSTOM_PROMPTS` feature flag and implement the `prompt-guard.ts` module.

**Acceptance Criteria:**

- [ ] `CUSTOM_PROMPTS` flag added to `src/lib/flags.ts`
- [ ] `validateCustomPrompt(prompt)` returns `{ valid: boolean; reason: string | null }`
- [ ] All injection patterns from spec FR-4 detected
- [ ] Legitimate prompts pass validation
- [ ] No internal detection rules exposed in error messages
- [ ] All tests from 1.1 pass

**Files:**

- `src/lib/flags.ts` (modify)
- `src/server/agents/prompt-guard.ts` (create)

---

## Phase 2: Settings Router Enhancement (Encryption + Injection Detection)

### Task 2.1: Settings Router Encryption + Validation — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 1.5 hours
**Dependencies:** Task 1.2

**Description:**
Write tests for the enhanced settings router: custom prompt encryption on save, decryption on read, injection detection before save. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Test `updateSeekerSettings` encrypts customPrompt before storage
- [ ] Test `updateSeekerSettings` rejects prompt that fails injection detection (BAD_REQUEST)
- [ ] Test `getSeekerSettings` decrypts customPrompt on retrieval
- [ ] Test `updateJobSettings` encrypts customPrompt before storage
- [ ] Test `updateJobSettings` rejects prompt that fails injection detection
- [ ] Test `getJobSettings` decrypts customPrompt on retrieval
- [ ] Test null/empty customPrompt stored as null (no encryption attempt)
- [ ] Test customPrompt operations gated behind `CUSTOM_PROMPTS` flag
- [ ] Test customPrompt cleared when set to null (removes encrypted value)
- [ ] Tests confirmed to FAIL

**Files:**

- `src/server/api/routers/settings.custom-prompt.test.ts`

---

### Task 2.2: Settings Router Encryption + Validation — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 1.5 hours
**Dependencies:** Task 2.1

**Description:**
Modify the settings router to encrypt custom prompts on save, decrypt on read, and run injection detection before save.

**Acceptance Criteria:**

- [ ] `updateSeekerSettings`: if `customPrompt` provided, validate with `validateCustomPrompt()`, then `encrypt()` before upsert
- [ ] `updateSeekerSettings`: if `customPrompt` is null, store null
- [ ] `getSeekerSettings`: if `customPrompt` exists, `decrypt()` before returning
- [ ] `updateJobSettings`: same encryption/validation flow
- [ ] `getJobSettings`: same decryption flow
- [ ] Injection detection failure throws `TRPCError({ code: "BAD_REQUEST", message })` with user-friendly message
- [ ] `CUSTOM_PROMPTS` flag checked before processing customPrompt field
- [ ] All tests from 2.1 pass

**Files:**

- `src/server/api/routers/settings.ts` (modify)

---

## Phase 3: Agent Context Integration

### Task 3.1: Agent Prompt Sandbox Injection — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 2 hours
**Dependencies:** Task 1.2
**Parallel with:** Task 2.1

**Description:**
Write tests for custom prompt injection into agent context. Tests cover both seeker and employer agents, sandbox framing, null handling, and guardrail preservation. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Test `buildSeekerPrompt()` includes `<user-customization>` block when customPrompt is provided
- [ ] Test `buildSeekerPrompt()` omits sandbox section when customPrompt is null/empty
- [ ] Test sandbox section appears AFTER core guardrails in system prompt
- [ ] Test sandbox framing text is present ("user-provided", "CANNOT override")
- [ ] Test employer agent system prompt includes sandbox when customPrompt provided
- [ ] Test employer agent system prompt omits sandbox when customPrompt null
- [ ] Test whitespace-only customPrompt treated as empty (no sandbox injected)
- [ ] Test full 2000-char prompt injected without truncation
- [ ] Test core guardrail text (anti-discrimination, privacy rules) still present when custom prompt is set
- [ ] Tests confirmed to FAIL

**Files:**

- `src/server/agents/seeker-agent.test.ts` (create or extend)
- `src/server/agents/employer-agent.test.ts` (create or extend)

---

### Task 3.2: Agent Prompt Sandbox Injection — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5 hours
**Dependencies:** Task 3.1

**Description:**
Modify agent prompt builders to accept and inject custom prompts into a sandboxed section of the system prompt.

**Acceptance Criteria:**

- [ ] `buildSeekerPrompt()` accepts optional `customPrompt?: string` parameter
- [ ] When provided, appends `<user-customization>` block to system prompt after all core instructions
- [ ] Sandbox framing: "user-provided customization", "CANNOT override any instructions above"
- [ ] Employer agent wrapper in `run-agent-conversation.ts` accepts and injects custom prompt similarly
- [ ] Null/empty/whitespace-only prompts: no sandbox section injected
- [ ] All tests from 3.1 pass

**Files:**

- `src/server/agents/seeker-agent.ts` (modify)
- `src/server/inngest/functions/run-agent-conversation.ts` (modify)

---

### Task 3.3: Conversation Workflow Integration — Tests

**Status:** 🔴 Blocked by 3.2
**Effort:** 1.5 hours
**Dependencies:** Task 3.2

**Description:**
Write tests for the `run-agent-conversation` Inngest workflow loading and passing custom prompts to agents. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Test `load-context` step loads `customPrompt` from SeekerSettings
- [ ] Test `load-context` step loads `customPrompt` from JobSettings
- [ ] Test custom prompts are decrypted before passing to agent wrappers
- [ ] Test null custom prompts are handled gracefully (agents called without custom prompt)
- [ ] Test `CUSTOM_PROMPTS` flag OFF: custom prompts not loaded/passed even if stored
- [ ] Tests confirmed to FAIL

**Files:**

- `src/server/inngest/functions/run-agent-conversation.test.ts` (extend)

---

### Task 3.4: Conversation Workflow Integration — Implementation

**Status:** 🔴 Blocked by 3.3, 2.2
**Effort:** 1.5 hours
**Dependencies:** Tasks 3.3, 2.2

**Description:**
Modify the `run-agent-conversation` Inngest workflow to load, decrypt, and pass custom prompts to agent wrappers.

**Acceptance Criteria:**

- [ ] `load-context` step queries `customPrompt` from SeekerSettings and JobSettings
- [ ] `customPrompt` values decrypted using existing `decrypt()` function
- [ ] Decrypted prompts passed to `makeEmployerAgentFn()` and `makeSeekerAgentFn()` closures
- [ ] Agent wrappers forward custom prompt to prompt builders
- [ ] When `CUSTOM_PROMPTS` flag is OFF, skip loading/decryption (pass null)
- [ ] All tests from 3.3 pass

**Files:**

- `src/server/inngest/functions/run-agent-conversation.ts` (modify)

---

## Phase 4: API Layer (Examples + Validation Endpoint)

### Task 4.1: Custom Prompts Router — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2
**Parallel with:** Tasks 2.1, 3.1

**Description:**
Write tests for the new `customPrompts` tRPC router: example prompts retrieval and dry-run validation. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Test `getExamples` returns at least 3 examples for "seeker" type
- [ ] Test `getExamples` returns at least 3 examples for "employer" type
- [ ] Test each example has id, title, description, prompt, userType fields
- [ ] Test `validatePrompt` returns `{ valid: true, reason: null }` for legitimate prompt
- [ ] Test `validatePrompt` returns `{ valid: false, reason: "..." }` for injection attempt
- [ ] Test both procedures gated behind `CUSTOM_PROMPTS` flag
- [ ] Tests confirmed to FAIL

**Files:**

- `src/server/api/routers/custom-prompts.test.ts`

---

### Task 4.2: Custom Prompts Router — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 1 hour
**Dependencies:** Task 4.1

**Description:**
Create the `customPrompts` tRPC router with example prompts and validation endpoint.

**Acceptance Criteria:**

- [ ] `getExamples` procedure: accepts `{ userType: "seeker" | "employer" }`, returns curated examples
- [ ] 3+ seeker examples (work-life balance, salary assertiveness, career change)
- [ ] 3+ employer examples (culture fit priority, growth potential, technical depth)
- [ ] `validatePrompt` procedure: accepts `{ prompt: string }`, calls `validateCustomPrompt()`, returns result
- [ ] Router registered in `src/server/api/root.ts`
- [ ] Both procedures gated with `assertFlagEnabled(CUSTOM_PROMPTS)`
- [ ] All tests from 4.1 pass

**Files:**

- `src/server/api/routers/custom-prompts.ts` (create)
- `src/server/api/root.ts` (modify)

---

## Phase 5: UI Enhancement

### Task 5.1: Example Prompt Selector + Validation UI — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1 hour
**Dependencies:** Task 4.2

**Description:**
Write component tests for the example prompt selector and validation feedback UI. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Test example prompts render with title and description
- [ ] Test clicking an example inserts its text into the prompt textarea
- [ ] Test character counter displays remaining characters correctly
- [ ] Test validation error message appears when injection detected
- [ ] Test prompt textarea hidden when `CUSTOM_PROMPTS` flag is OFF
- [ ] Test component renders correctly with no existing custom prompt (empty state)
- [ ] Tests confirmed to FAIL

**Files:**

- `tests/unit/components/settings/custom-prompt-editor.test.tsx`

---

### Task 5.2: Example Prompt Selector + Validation UI — Implementation

**Status:** 🔴 Blocked by 5.1
**Effort:** 1.5 hours
**Dependencies:** Task 5.1

**Description:**
Create the `CustomPromptEditor` component and integrate into existing settings pages.

**Acceptance Criteria:**

- [ ] `CustomPromptEditor` component with textarea, character counter, example selector, and validation feedback
- [ ] Character counter shows "X / 2,000" format
- [ ] Example prompts fetched via `trpc.customPrompts.getExamples` query
- [ ] One-click insert from example to textarea
- [ ] On blur: call `trpc.customPrompts.validatePrompt` for real-time feedback
- [ ] Validation error displayed inline below textarea
- [ ] Component hidden when `CUSTOM_PROMPTS` flag is OFF
- [ ] Integrated into seeker private settings page (replacing raw textarea)
- [ ] Integrated into employer job settings page (replacing raw textarea)
- [ ] All tests from 5.1 pass

**Files:**

- `src/components/settings/custom-prompt-editor.tsx` (create)
- `src/app/(seeker)/settings/private/page.tsx` (modify)
- `src/app/(employer)/postings/[id]/settings/page.tsx` (modify)

---

## Phase 6: Quality Gates

### Task 6.1: Full Test Suite Validation

**Status:** 🔴 Blocked by 5.2, 3.4
**Effort:** 0.5 hours
**Dependencies:** All implementation tasks

**Description:**
Run the complete test suite to verify no regressions. Verify coverage meets 80% threshold for all new code.

**Acceptance Criteria:**

- [ ] All new tests pass (prompt guard, settings encryption, agent integration, router, UI)
- [ ] All existing tests still pass (no regressions)
- [ ] New code coverage ≥ 80%
- [ ] No TypeScript compilation errors

---

### Task 6.2: Security Review

**Status:** 🔴 Blocked by 6.1
**Effort:** 0.5 hours
**Dependencies:** Task 6.1

**Description:**
Review all security-sensitive code: injection detection patterns, encryption usage, privacy boundaries.

**Acceptance Criteria:**

- [ ] Injection detection covers all patterns from spec FR-4
- [ ] Custom prompts encrypted at rest correctly
- [ ] Custom prompts never appear in logs or conversation records
- [ ] Privacy boundaries enforced (not exposed to other party)
- [ ] No hardcoded secrets
- [ ] All CRITICAL/HIGH issues resolved

---

## Summary

| Phase                | Tasks              | Description                                             |
| -------------------- | ------------------ | ------------------------------------------------------- |
| 1. Foundation        | 1.1, 1.2           | Feature flag + prompt injection detection               |
| 2. Settings          | 2.1, 2.2           | Encryption/decryption + validation in settings router   |
| 3. Agent Integration | 3.1, 3.2, 3.3, 3.4 | Sandbox injection into agent prompts + workflow loading |
| 4. API Layer         | 4.1, 4.2           | Example prompts router + validation endpoint            |
| 5. UI                | 5.1, 5.2           | Custom prompt editor component + page integration       |
| 6. Quality           | 6.1, 6.2           | Full suite validation + security review                 |

**Total Tasks:** 14
**Total Phases:** 6

## Parallelization Opportunities

- Tasks 2.1, 3.1, and 4.1 can all start in parallel after 1.2 completes (independent test suites)
- Tasks 2.2, 3.2, and 4.2 can proceed independently once their respective test tasks complete

## Critical Path

```
1.1 → 1.2 → 3.1 → 3.2 → 3.3 → 3.4 → 6.1 → 6.2
```

## User Story to Task Mapping

| User Story                                     | Tasks                        |
| ---------------------------------------------- | ---------------------------- |
| US1: Seeker writes custom prompt               | 2.1, 2.2, 5.1, 5.2           |
| US2: Employer writes custom prompt per posting | 2.1, 2.2, 5.1, 5.2           |
| US3: Custom prompt influences agent behavior   | 3.1, 3.2, 3.3, 3.4           |
| US4: Example prompts and guidance              | 4.1, 4.2, 5.1, 5.2           |
| US5: Prompt injection detection                | 1.1, 1.2, 2.1, 2.2           |
| US6: Feature flag gating                       | 1.1, 1.2, 3.3, 3.4, 4.1, 4.2 |
