# Task Breakdown — 21-advanced-chat-with-tools

**Plan:** `.specify/specs/21-advanced-chat-with-tools/plan.md`
**Created:** 2026-03-17
**Total Tasks:** 10
**Dependency:** Feature 20 must be complete first.
**Critical Path:** 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1

---

## Phase 1: Tool Result Components

### Task 1.1: Component Tests

**Status:** 🟡 Ready (after Feature 20)
**Effort:** 2 hours
**Dependencies:** Feature 20 complete
**User Stories:** US-1 (job cards), US-2 (match table), US-3 (profile card)

**Description:**
Write tests for tool result rendering components. **TESTS FIRST.**

**Test file:** `tests/unit/components/chat/tool-result-renderer.test.tsx`

**Acceptance Criteria:**

- [ ] Test: `searchJobs` results render as individual cards with title, company, location
- [ ] Test: `getMyMatches` results render as table with confidence badges
- [ ] Test: `getCandidates` results render as table with candidate names and scores
- [ ] Test: `getMyProfile` results render as profile card with skills tags
- [ ] Test: unknown tool name renders formatted JSON fallback
- [ ] Test: missing/null fields display "—" gracefully
- [ ] Test: responsive layout switches to stacked cards below 768px
- [ ] All tests FAIL

---

### Task 1.2: Component Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 3 hours
**Dependencies:** Task 1.1

**Description:**
Implement tool result rendering components.

**Files:**

- `src/components/chat/tool-result-renderer.tsx`
- `src/components/chat/job-search-cards.tsx`
- `src/components/chat/match-summary-table.tsx`
- `src/components/chat/profile-preview-card.tsx`

**Acceptance Criteria:**

- [ ] `ToolResultRenderer` dispatches by tool name to correct component
- [ ] `JobSearchCards` renders card grid with job details
- [ ] `MatchSummaryTable` renders table with confidence badges and status chips
- [ ] `ProfilePreviewCard` renders profile summary with completeness indicator
- [ ] All components handle missing data with fallback values
- [ ] All components responsive (table → stacked cards on mobile)
- [ ] All tests from Task 1.1 PASS

---

## Phase 2: Suggestion Buttons

### Task 2.1: Suggestion Buttons — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2
**User Stories:** US-4 (suggested actions)

**Description:**
Write tests for suggestion button component. **TESTS FIRST.**

**Test file:** `tests/unit/components/chat/suggestion-buttons.test.tsx`

**Acceptance Criteria:**

- [ ] Test: renders button for each suggestion
- [ ] Test: clicking button calls sendMessage with the suggestion text
- [ ] Test: renders correct suggestions for `searchJobs` results
- [ ] Test: renders correct suggestions for `getMyMatches` results
- [ ] Test: renders no buttons when no suggestions configured
- [ ] All tests FAIL

---

### Task 2.2: Suggestion Buttons — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 1 hour
**Dependencies:** Task 2.1

**Description:**
Implement suggestion buttons component and suggestion config per tool name.

**File:** `src/components/chat/suggestion-buttons.tsx`

**Acceptance Criteria:**

- [ ] Renders horizontal button row below tool results
- [ ] Click sends message via provided `onSend` callback
- [ ] Suggestion config maps tool names to contextual suggestions
- [ ] Buttons visually distinct from chat messages (outlined/ghost style)
- [ ] All tests from Task 2.1 PASS

---

## Phase 3: ChatInterface Integration

### Task 3.1: Integration — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1 hour
**Dependencies:** Tasks 1.2, 2.2

**Description:**
Update ChatInterface tests to verify tool result rendering integration. **TESTS FIRST.**

**File:** Update `tests/unit/components/chat/chat-interface.test.tsx`

**Acceptance Criteria:**

- [ ] Test: message with tool result part renders ToolResultRenderer
- [ ] Test: suggestion buttons appear after tool result messages
- [ ] Test: on history reload, tool results render as static (no suggestion buttons)
- [ ] All tests FAIL

---

### Task 3.2: Integration — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5 hours
**Dependencies:** Task 3.1

**Description:**
Update `ChatInterface` to detect tool result parts in messages and render structured components.

**File:** `src/components/chat/chat-interface.tsx`

**Acceptance Criteria:**

- [ ] Message rendering loop detects `ToolUIPart` in message parts
- [ ] Tool results passed to `ToolResultRenderer`
- [ ] Suggestion buttons rendered after tool result messages
- [ ] History messages render tool results as static (no interactive suggestions)
- [ ] All tests from Task 3.1 PASS

---

## Phase 4: Quality Gates

### Task 4.1: Coverage & Visual Verification

**Status:** 🔴 Blocked by 3.2
**Effort:** 1 hour
**Dependencies:** All implementation tasks

**Acceptance Criteria:**

- [ ] `pnpm test` passes with zero failures
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] 80%+ test coverage on new component files
- [ ] Components render correctly at 375px, 768px, and 1920px widths

---

## Dependency Graph

```
1.1 Component Tests → 1.2 Component Impl
                         └─ blocks: 2.1
2.1 Suggestion Tests → 2.2 Suggestion Impl
                         └─ blocks: 3.1
3.1 Integration Tests → 3.2 Integration Impl → 4.1 Verification
```

## Critical Path

```
1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1
2h    3h    1h    1h    1h   1.5h   1h  = 10.5 hours
```

No parallelization opportunities — all tasks are sequential.

## Task Summary

| Phase          | Tasks | Effort    |
| -------------- | ----- | --------- |
| 1. Components  | 2     | 5h        |
| 2. Suggestions | 2     | 2h        |
| 3. Integration | 2     | 2.5h      |
| 4. Quality     | 1     | 1h        |
| **Total**      | **7** | **10.5h** |
