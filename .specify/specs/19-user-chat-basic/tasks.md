# Task Breakdown — 19-user-chat-basic

**Plan:** `.specify/specs/19-user-chat-basic/plan.md`
**Spec:** `.specify/specs/19-user-chat-basic/spec.md`
**Created:** 2026-03-16
**Total Tasks:** 19
**Total Phases:** 6
**Critical Path:** 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 5.1 → 5.2 → 5.3

---

## Phase 1: Foundation (Database & Configuration)

### Task 1.1: Schema & Migration

**Status:** 🟡 Ready
**Effort:** 1 hour
**Dependencies:** None
**User Stories:** Foundation for all stories
**Parallel with:** None (must be first)

**Description:**
Add `ChatMessageRole` enum and `ChatMessage` model to Prisma schema. Generate and apply migration.

**Acceptance Criteria:**

- [ ] `ChatMessageRole` enum added (`USER`, `ASSISTANT`)
- [ ] `ChatMessage` model added with fields: id, clerkUserId, role, content, createdAt
- [ ] Composite index on (clerkUserId, createdAt DESC) created
- [ ] Simple index on clerkUserId created
- [ ] Table mapped to `chat_messages`
- [ ] Migration generated and applies cleanly
- [ ] `pnpm db:generate` succeeds

---

### Task 1.2: Rate Limit & Feature Flag Configuration

**Status:** 🟡 Ready
**Effort:** 30 min
**Dependencies:** None
**User Stories:** US-6 (BYOK required), all stories (feature flag)
**Parallel with:** Task 1.1

**Description:**
Add `chat` rate limit category (10 requests/minute) to rate-limit.ts and `USER_CHAT` feature flag to flags.ts.

**Acceptance Criteria:**

- [ ] `chat` category added to `RATE_LIMIT_CATEGORIES` with `{ requests: 10, window: "1m" }`
- [ ] `USER_CHAT` flag defined in flags.ts
- [ ] Existing rate limit tests still pass
- [ ] TypeScript compiles cleanly

---

## Phase 2: Chat Agent Logic

### Task 2.1: Context Assembly & System Prompt — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 2 hours
**Dependencies:** Task 1.1
**User Stories:** US-1 (seeker matches), US-2 (employer pipeline), US-5 (context awareness)

**Description:**
Write tests for `assembleChatContext()` and `buildChatSystemPrompt()`. **TESTS FIRST (TDD).**

**Test file:** `src/server/agents/chat-agent.test.ts`

**Acceptance Criteria:**

- [ ] Test: seeker context includes profile name, skills, headline
- [ ] Test: seeker context includes match summaries (last 10)
- [ ] Test: seeker context includes own private settings (minSalary, dealBreakers)
- [ ] Test: employer context includes company name, active posting titles, match counts
- [ ] Test: employer context includes conversation outcome summaries
- [ ] Test: context NEVER includes other users' private data
- [ ] Test: system prompt contains "your JobBobber agent" identification
- [ ] Test: system prompt contains read-only instruction
- [ ] Test: system prompt contains off-topic redirection instruction
- [ ] Test: system prompt injects actual user data (name, skill count, match count)
- [ ] All tests FAIL (no implementation yet)

---

### Task 2.2: Context Assembly & System Prompt — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2 hours
**Dependencies:** Task 2.1

**Description:**
Implement `assembleChatContext()` and `buildChatSystemPrompt()` in `src/server/agents/chat-agent.ts` to pass all tests from Task 2.1.

**File:** `src/server/agents/chat-agent.ts`

**Acceptance Criteria:**

- [ ] `ChatAgentContext` Zod schema defined
- [ ] `assembleChatContext(db, userId, userRole)` queries profile, matches, settings, conversation logs
- [ ] Seeker path: fetches JobSeeker + SeekerSettings + recent Matches + AgentConversation summaries
- [ ] Employer path: fetches Employer + active JobPostings + Matches per posting + AgentConversation summaries
- [ ] `buildChatSystemPrompt(context)` returns a system prompt string with injected user data
- [ ] DB queries run in parallel (Promise.all) for <100ms target
- [ ] All tests from Task 2.1 PASS
- [ ] No `as any` casts — fully typed

---

## Phase 3: Streaming Route Handler

### Task 3.1: Route Handler — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 2.5 hours
**Dependencies:** Task 2.2
**User Stories:** US-1, US-2, US-3 (streaming), US-6 (BYOK required)

**Description:**
Write tests for the POST `/api/chat` Route Handler. Mock AI SDK, Clerk auth, rate limiter, and Prisma. **TESTS FIRST (TDD).**

**Test file:** `src/app/api/chat/route.test.ts`

**Acceptance Criteria:**

- [ ] Test: returns 401 when not authenticated
- [ ] Test: returns 403 when no BYOK key configured (seeker)
- [ ] Test: returns 403 when no BYOK key configured (employer)
- [ ] Test: returns 429 when rate limit exceeded
- [ ] Test: calls `decrypt()` with correct scopeId for seeker
- [ ] Test: calls `decrypt()` with correct scopeId for employer
- [ ] Test: calls `streamText()` with correct model (gpt-4o-mini for OpenAI, claude-haiku for Anthropic)
- [ ] Test: persists user message to ChatMessage before streaming
- [ ] Test: persists assistant message to ChatMessage after streaming completes
- [ ] Test: passes assembled context as system prompt
- [ ] Test: validates input message array with Zod
- [ ] Test: rejects messages exceeding 5000 character limit
- [ ] All tests FAIL (no implementation yet)

---

### Task 3.2: Route Handler — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 2.5 hours
**Dependencies:** Task 3.1

**Description:**
Implement `POST /api/chat` Route Handler to pass all tests from Task 3.1.

**File:** `src/app/api/chat/route.ts`

**Acceptance Criteria:**

- [ ] Auth via `getAuth()` — 401 if no userId
- [ ] Rate limit via `checkRateLimit(userId, "chat")` — 429 if exceeded
- [ ] BYOK key lookup: seeker via SeekerSettings, employer via Employer
- [ ] Key decryption via `decrypt()`
- [ ] Context assembly via `assembleChatContext()`
- [ ] Input validation: messages array, max content length 5000
- [ ] `streamText()` call with correct provider + model
- [ ] User message persisted before streaming
- [ ] Assistant message persisted via `onFinish` callback
- [ ] Returns streaming Response
- [ ] All tests from Task 3.1 PASS

---

## Phase 4: tRPC Chat History Router

### Task 4.1: Chat Router — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 1.5 hours
**Dependencies:** Task 1.1
**User Stories:** US-4 (history persistence)
**Parallel with:** Tasks 2.1, 2.2, 3.1, 3.2 (independent)

**Description:**
Write tests for the tRPC `chat.getHistory` procedure. **TESTS FIRST (TDD).**

**Test file:** `src/server/api/routers/chat.test.ts`

**Acceptance Criteria:**

- [ ] Test: returns messages for authenticated user only (no cross-user leakage)
- [ ] Test: returns empty array when no messages exist
- [ ] Test: messages ordered by createdAt descending
- [ ] Test: cursor-based pagination returns correct page
- [ ] Test: respects limit parameter (default 50, max 100)
- [ ] Test: nextCursor is null when no more messages
- [ ] Test: hasMore is true when more messages exist
- [ ] All tests FAIL (no implementation yet)

---

### Task 4.2: Chat Router — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 1 hour
**Dependencies:** Task 4.1

**Description:**
Implement `chatRouter` with `getHistory` procedure. Register in root router. Add typed hook.

**Files:**

- `src/server/api/routers/chat.ts`
- `src/server/api/root.ts` (add chatRouter)
- `src/lib/trpc/hooks.ts` (add useChatGetHistory)

**Acceptance Criteria:**

- [ ] `chatRouter` created with `getHistory` procedure using `protectedProcedure`
- [ ] Input: `{ cursor?: string, limit?: number }` validated with Zod
- [ ] Queries ChatMessage filtered by `ctx.userId`, ordered `createdAt DESC`
- [ ] Cursor-based pagination (existing codebase pattern)
- [ ] Returns `{ items, nextCursor, hasMore }`
- [ ] Router registered in `appRouter` in root.ts
- [ ] `useChatGetHistory()` typed hook added to hooks.ts
- [ ] All tests from Task 4.1 PASS
- [ ] TypeScript compiles cleanly (no TS2589)

---

## Phase 5: Chat UI

### Task 5.1: ChatInterface Component — Tests

**Status:** 🔴 Blocked by 3.2, 4.2
**Effort:** 2 hours
**Dependencies:** Tasks 3.2, 4.2
**User Stories:** US-1, US-2, US-3, US-4, US-6

**Description:**
Write component tests for `ChatInterface`. Mock `useChat()` hook and tRPC hooks. **TESTS FIRST (TDD).**

**Test file:** `tests/unit/components/chat/chat-interface.test.tsx`

**Acceptance Criteria:**

- [ ] Test: renders loading skeleton while history loads
- [ ] Test: displays BYOK setup prompt when `hasByokKey` is false
- [ ] Test: renders message list with user and assistant messages differentiated
- [ ] Test: input field enforces 5000 character limit
- [ ] Test: send button disabled while loading/streaming
- [ ] Test: displays error message on provider failure
- [ ] Test: displays rate limit exceeded message
- [ ] Test: previous messages displayed on mount (from getHistory)
- [ ] Test: scrolls to bottom when new message appears
- [ ] All tests FAIL (no implementation yet)

---

### Task 5.2: ChatInterface Component — Implementation

**Status:** 🔴 Blocked by 5.1
**Effort:** 3 hours
**Dependencies:** Task 5.1

**Description:**
Implement the `ChatInterface` shared component.

**File:** `src/components/chat/chat-interface.tsx`

**Acceptance Criteria:**

- [ ] Uses `useChat()` from Vercel AI SDK pointed at `/api/chat`
- [ ] Loads persisted history via `useChatGetHistory()` on mount
- [ ] Merges persisted history with useChat-managed messages (dedup by content+timestamp)
- [ ] Message list: user messages right-aligned, assistant left-aligned
- [ ] Input field with character counter and 5000 char limit
- [ ] Send button with loading spinner during streaming
- [ ] Error display for provider errors (user-friendly messages)
- [ ] Rate limit message when 429 received
- [ ] Auto-scroll to latest message
- [ ] BYOK setup prompt when no key configured (prop-driven)
- [ ] All tests from Task 5.1 PASS

---

### Task 5.3: Chat Pages (Seeker & Employer)

**Status:** 🔴 Blocked by 5.2
**Effort:** 1 hour
**Dependencies:** Task 5.2
**Parallel with:** None

**Description:**
Create the seeker and employer chat page routes that render `ChatInterface`.

**Files:**

- `src/app/(seeker)/chat/page.tsx`
- `src/app/(employer)/dashboard/chat/page.tsx`

**Acceptance Criteria:**

- [ ] Seeker chat page at `/chat` route
- [ ] Employer chat page at `/dashboard/chat` route
- [ ] Both check `USER_CHAT` feature flag — show "coming soon" if disabled
- [ ] Both check BYOK key status — pass `hasByokKey` prop to ChatInterface
- [ ] Both render ChatInterface with appropriate layout
- [ ] TypeScript compiles cleanly

---

## Phase 6: Compliance & Quality Gates

### Task 6.1: GDPR Deletion Update — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 30 min
**Dependencies:** Task 1.1
**User Stories:** FR-016 (GDPR)
**Parallel with:** Tasks 2.x, 3.x, 4.x, 5.x (independent)

**Description:**
Write test verifying chat messages are deleted during account deletion. **TESTS FIRST (TDD).**

**Test file:** Update `src/server/inngest/functions/execute-account-deletion.test.ts` (if exists) or create new.

**Acceptance Criteria:**

- [ ] Test: account deletion removes all ChatMessage rows for the user
- [ ] Test: other users' ChatMessages are not affected
- [ ] Test FAILS (deletion step not yet added)

---

### Task 6.2: GDPR Deletion Update — Implementation

**Status:** 🔴 Blocked by 6.1
**Effort:** 30 min
**Dependencies:** Task 6.1

**Description:**
Add ChatMessage deletion step to `execute-account-deletion.ts` Inngest function.

**File:** `src/server/inngest/functions/execute-account-deletion.ts`

**Acceptance Criteria:**

- [ ] New Inngest step: `await step.run("delete-chat-messages", ...)`
- [ ] Deletes all ChatMessage where clerkUserId matches
- [ ] Step runs before user record deletion
- [ ] Test from Task 6.1 PASSES
- [ ] Existing deletion tests still pass

---

### Task 6.3: Security Review

**Status:** 🔴 Blocked by 3.2, 4.2
**Effort:** 1 hour
**Dependencies:** Tasks 3.2, 4.2

**Description:**
Security review of chat implementation. Focus on cross-user data isolation, BYOK key handling, and prompt injection resistance.

**Acceptance Criteria:**

- [ ] No cross-user data leakage paths identified
- [ ] BYOK key never logged, never sent to client, never cached
- [ ] System prompt role boundaries prevent injection via user messages
- [ ] Rate limiting verified functional
- [ ] All CRITICAL/HIGH issues resolved

---

### Task 6.4: Coverage & Integration Verification

**Status:** 🔴 Blocked by all implementation tasks
**Effort:** 1 hour
**Dependencies:** Tasks 2.2, 3.2, 4.2, 5.2, 6.2

**Description:**
Final verification: all tests pass, 80%+ coverage on chat code, TypeScript clean, lint clean.

**Acceptance Criteria:**

- [ ] `pnpm test` passes with zero failures
- [ ] `pnpm test:coverage` shows 80%+ on new chat files
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] Pre-commit hooks pass
- [ ] All 6 user stories verified against acceptance criteria

---

## Dependency Graph

```
Phase 1 (parallel):
  1.1 Schema & Migration ─────┬── blocks: 2.1, 4.1, 6.1
  1.2 Rate Limit & Flag ──────┘   (parallel with 1.1)

Phase 2 (sequential, on critical path):
  2.1 Agent Tests ─────── blocks: 2.2
  2.2 Agent Implementation ── blocks: 3.1

Phase 3 (sequential, on critical path):
  3.1 Route Handler Tests ── blocks: 3.2
  3.2 Route Handler Impl ─── blocks: 5.1, 6.3

Phase 4 (parallel with Phase 2-3):
  4.1 Router Tests ──── blocks: 4.2
  4.2 Router Impl ───── blocks: 5.1, 6.3

Phase 5 (sequential, on critical path):
  5.1 UI Tests ────── blocks: 5.2
  5.2 UI Impl ─────── blocks: 5.3
  5.3 Pages ───────── blocks: 6.4

Phase 6 (mixed):
  6.1 GDPR Tests ──── blocks: 6.2  (parallel with Phase 2-5)
  6.2 GDPR Impl ───── blocks: 6.4  (parallel with Phase 2-5)
  6.3 Security Review ── blocks: 6.4
  6.4 Final Verification (depends on everything)
```

---

## Critical Path

```
1.1 → 2.1 → 2.2 → 3.1 → 3.2 → 5.1 → 5.2 → 5.3 → 6.4
 1h    2h    2h   2.5h  2.5h   2h    3h    1h    1h  = 17 hours
```

**With parallelization:**

- Tasks 1.2, 4.1, 4.2, 6.1, 6.2 run parallel to the critical path
- Saves ~4.5 hours of elapsed time
- **Effective duration: ~17 hours** (critical path dominates)

---

## Task Summary

| Phase            | Tasks  | Test Tasks | Impl Tasks | Effort  |
| ---------------- | ------ | ---------- | ---------- | ------- |
| 1. Foundation    | 2      | 0          | 2          | 1.5h    |
| 2. Agent Logic   | 2      | 1          | 1          | 4h      |
| 3. Route Handler | 2      | 1          | 1          | 5h      |
| 4. tRPC Router   | 2      | 1          | 1          | 2.5h    |
| 5. Chat UI       | 3      | 1          | 2          | 6h      |
| 6. Compliance    | 4      | 1          | 3          | 3h      |
| **Total**        | **19** | **5**      | **14**     | **22h** |

### TDD Enforcement

Every implementation task is blocked by its test task:

- 2.1 (tests) → 2.2 (impl)
- 3.1 (tests) → 3.2 (impl)
- 4.1 (tests) → 4.2 (impl)
- 5.1 (tests) → 5.2 (impl)
- 6.1 (tests) → 6.2 (impl)

### User Story Coverage

| User Story                         | Tasks                             |
| ---------------------------------- | --------------------------------- |
| US-1: Seeker asks about matches    | 2.1, 2.2, 3.1, 3.2, 5.1, 5.2, 5.3 |
| US-2: Employer asks about pipeline | 2.1, 2.2, 3.1, 3.2, 5.1, 5.2, 5.3 |
| US-3: Streaming response           | 3.1, 3.2, 5.1, 5.2                |
| US-4: Chat history persistence     | 4.1, 4.2, 5.1, 5.2                |
| US-5: Agent context awareness      | 2.1, 2.2                          |
| US-6: BYOK key required            | 1.2, 3.1, 3.2, 5.1, 5.2           |
