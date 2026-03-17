# Task Breakdown — 22-streaming-structured-outputs

**Plan:** `.specify/specs/22-streaming-structured-outputs/plan.md`
**Created:** 2026-03-17
**Total Tasks:** 7
**Dependency:** Feature 19 complete. Independent of Features 20/21.
**Critical Path:** 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1

---

## Phase 1: Streaming Parser

### Task 1.1: Parser — Tests

**Status:** 🟡 Ready
**Effort:** 1.5 hours
**Dependencies:** None
**User Stories:** US-1 (progressive match analysis), US-3 (streaming fallback)

**Description:**
Write tests for the streaming text parser that detects section boundaries. **TESTS FIRST.**

**Test file:** `src/components/chat/streaming-parser.test.ts`

**Acceptance Criteria:**

- [ ] Test: detects markdown headers (##, ###) as field boundaries
- [ ] Test: detects bold labels (**Label:**) as field boundaries
- [ ] Test: returns complete fields with `state: 'complete'`
- [ ] Test: returns in-progress field with `state: 'streaming'`
- [ ] Test: returns pending fields with `state: 'pending'` (detected but no content yet)
- [ ] Test: handles plain text with no structure (returns single text field)
- [ ] Test: handles empty input gracefully
- [ ] Test: handles partial stream that ends mid-field
- [ ] All tests FAIL

---

### Task 1.2: Parser — Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 1.5 hours
**Dependencies:** Task 1.1

**Description:**
Implement the streaming text parser.

**File:** `src/components/chat/streaming-parser.ts`

**Acceptance Criteria:**

- [ ] Exports `parseStreamingFields(text: string): StreamingField[]`
- [ ] `StreamingField` type: `{ name: string, content: string, state: 'pending' | 'streaming' | 'complete' }`
- [ ] Detects section headers (##, ###) and bold labels (**Label:**)
- [ ] Last field always `state: 'streaming'` (still receiving tokens)
- [ ] Previous fields `state: 'complete'` (boundary detected = previous field done)
- [ ] Plain text without structure returns single field (no regression)
- [ ] All tests from Task 1.1 PASS

---

## Phase 2: Progressive Renderer

### Task 2.1: Renderer — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2
**User Stories:** US-1 (progressive match), US-2 (progressive profile)

**Description:**
Write tests for the progressive field renderer component. **TESTS FIRST.**

**Test file:** `tests/unit/components/chat/progressive-fields.test.tsx`

**Acceptance Criteria:**

- [ ] Test: complete fields render with full content and styled header
- [ ] Test: streaming field renders with content + blinking cursor indicator
- [ ] Test: pending fields render as skeleton placeholders
- [ ] Test: plain text (single field) renders identically to current behavior
- [ ] Test: error state preserves completed fields and shows error indicator
- [ ] All tests FAIL

---

### Task 2.2: Renderer — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 1 hour
**Dependencies:** Task 2.1

**Description:**
Implement the progressive field renderer.

**File:** `src/components/chat/progressive-fields.tsx`

**Acceptance Criteria:**

- [ ] `ProgressiveFields` component receives `fields: StreamingField[]`
- [ ] Complete fields: section header + full content, styled
- [ ] Streaming field: content visible + animated cursor
- [ ] Pending fields: gray skeleton placeholder with pulse animation
- [ ] Single-field plain text renders as-is (backward compatible)
- [ ] All tests from Task 2.1 PASS

---

## Phase 3: ChatInterface Integration

### Task 3.1: Integration — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 30 min
**Dependencies:** Task 2.2

**Description:**
Update ChatInterface tests for progressive rendering. **TESTS FIRST.**

**File:** Update `tests/unit/components/chat/chat-interface.test.tsx`

**Acceptance Criteria:**

- [ ] Test: assistant messages with `status === 'streaming'` use progressive renderer
- [ ] Test: completed assistant messages render normally (no progressive animation)
- [ ] All tests FAIL

---

### Task 3.2: Integration — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 30 min
**Dependencies:** Task 3.1

**Description:**
Wrap streaming assistant messages in the progressive renderer.

**File:** `src/components/chat/chat-interface.tsx`

**Acceptance Criteria:**

- [ ] Messages with streaming status use `ProgressiveFields` wrapper
- [ ] Completed messages render without progressive animation
- [ ] Regular text streaming (token-by-token) unaffected (no regression)
- [ ] All tests from Task 3.1 PASS

---

## Phase 4: Quality Gates

### Task 4.1: Coverage Verification

**Status:** 🔴 Blocked by 3.2
**Effort:** 30 min
**Dependencies:** All implementation tasks

**Acceptance Criteria:**

- [ ] `pnpm test` passes with zero failures
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] 80%+ test coverage on streaming-parser.ts and progressive-fields.tsx

---

## Dependency Graph

```
1.1 Parser Tests → 1.2 Parser Impl
                     └─ blocks: 2.1
2.1 Renderer Tests → 2.2 Renderer Impl
                       └─ blocks: 3.1
3.1 Integration Tests → 3.2 Integration Impl → 4.1 Verification
```

All tasks are sequential — no parallelization.

## Critical Path

```
1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1
1.5h  1.5h   1h    1h   30m   30m   30m  = 6.5 hours
```

## Task Summary

| Phase          | Tasks | Effort   |
| -------------- | ----- | -------- |
| 1. Parser      | 2     | 3h       |
| 2. Renderer    | 2     | 2h       |
| 3. Integration | 2     | 1h       |
| 4. Quality     | 1     | 30m      |
| **Total**      | **7** | **6.5h** |
