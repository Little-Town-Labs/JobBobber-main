# Task Breakdown — 20-agent-tool-calling

**Plan:** `.specify/specs/20-agent-tool-calling/plan.md`
**Created:** 2026-03-17
**Total Tasks:** 8
**Critical Path:** 1.1 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1

---

## Phase 1: Foundation

### Task 1.1: Feature Flag

**Status:** 🟡 Ready
**Effort:** 15 min
**Dependencies:** None

**Description:**
Add `AGENT_TOOL_CALLING` feature flag to `src/lib/flags.ts`.

**Acceptance Criteria:**

- [ ] `AGENT_TOOL_CALLING` flag defined (default: false)
- [ ] TypeScript compiles cleanly

---

## Phase 2: Tool Definitions

### Task 2.1: Seeker Tools — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 2 hours
**Dependencies:** Task 1.1
**User Stories:** US-1 (search jobs), US-2 (match status), US-4 (profile), US-5 (conversations)

**Description:**
Write tests for all 4 seeker tools. Mock the database. **TESTS FIRST.**

**Test file:** `src/server/agents/chat-tools.test.ts`

**Acceptance Criteria:**

- [ ] Test: `searchJobs` returns matching postings (title, company, location, salary)
- [ ] Test: `searchJobs` returns max 10 results
- [ ] Test: `searchJobs` returns empty array when no matches
- [ ] Test: `getMyMatches` returns seeker's matches with confidence and status
- [ ] Test: `getMyMatches` does NOT return other seekers' matches
- [ ] Test: `getMyProfile` returns current profile data
- [ ] Test: `getConversationSummary` returns conversation outcome for specified company
- [ ] Test: `getConversationSummary` returns null when no conversation found
- [ ] All tests FAIL (no implementation yet)

---

### Task 2.2: Seeker Tools — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2.5 hours
**Dependencies:** Task 2.1

**Description:**
Implement `buildSeekerTools(db, seekerId)` returning 4 tools using `tool()` from `ai` package.

**File:** `src/server/agents/chat-tools.ts`

**Acceptance Criteria:**

- [ ] `searchJobs`: queries active JobPostings by skills/title/location, returns top 10
- [ ] `getMyMatches`: queries Matches by seekerId with posting+employer includes
- [ ] `getMyProfile`: queries JobSeeker by id, returns profile fields
- [ ] `getConversationSummary`: queries AgentConversation by seekerId + posting title fuzzy match
- [ ] All tools use Zod schemas for parameters
- [ ] All tools filter by ownership (seekerId)
- [ ] Tool output types exported for use by Feature 21 components
- [ ] All tests from Task 2.1 PASS

---

### Task 2.3: Employer Tools — Tests

**Status:** 🔴 Blocked by 1.1
**Effort:** 2 hours
**Dependencies:** Task 1.1
**User Stories:** US-3 (candidate pipeline)
**Parallel with:** Tasks 2.1, 2.2

**Description:**
Write tests for all 4 employer tools. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: `getCandidates` returns candidates for a specific posting with scores
- [ ] Test: `getCandidates` does NOT return candidates from other employers' postings
- [ ] Test: `getMyPostings` returns employer's postings with match counts
- [ ] Test: `getPostingDetails` returns full posting details for owned posting
- [ ] Test: `getPostingDetails` rejects request for another employer's posting
- [ ] Test: `getConversationSummary` returns conversations scoped to employer's postings
- [ ] All tests FAIL (no implementation yet)

---

### Task 2.4: Employer Tools — Implementation

**Status:** 🔴 Blocked by 2.3
**Effort:** 2 hours
**Dependencies:** Task 2.3
**Parallel with:** Tasks 2.1, 2.2

**Description:**
Implement `buildEmployerTools(db, employerId)` returning 4 tools.

**File:** `src/server/agents/chat-tools.ts`

**Acceptance Criteria:**

- [ ] `getCandidates`: queries Matches by jobPostingId (owned by employer) with seeker includes
- [ ] `getMyPostings`: queries JobPostings by employerId with match counts
- [ ] `getPostingDetails`: queries single JobPosting by id, verified owned by employer
- [ ] `getConversationSummary`: queries AgentConversation scoped to employer's postings
- [ ] All tools filter by ownership (employerId)
- [ ] All tests from Task 2.3 PASS

---

## Phase 3: Route Handler Integration

### Task 3.1: Route Handler — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1.5 hours
**Dependencies:** Tasks 2.2, 2.4

**Description:**
Add tests to route handler verifying tool integration. **TESTS FIRST.**

**File:** Update `src/app/api/chat/route.test.ts`

**Acceptance Criteria:**

- [ ] Test: seeker request includes seeker tools in streamText call
- [ ] Test: employer request includes employer tools in streamText call
- [ ] Test: tools NOT passed when `AGENT_TOOL_CALLING` flag is disabled
- [ ] Test: `maxSteps` set to 3 when tools are enabled
- [ ] All tests FAIL (implementation not updated yet)

---

### Task 3.2: Route Handler — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1 hour
**Dependencies:** Task 3.1

**Description:**
Modify `POST /api/chat` to pass role-scoped tools to `streamText()`.

**File:** `src/app/api/chat/route.ts`

**Acceptance Criteria:**

- [ ] Import `buildSeekerTools` and `buildEmployerTools` from chat-tools
- [ ] Check `AGENT_TOOL_CALLING` flag — only pass tools when enabled
- [ ] Pass `tools` and `maxSteps: 3` to `streamText()`
- [ ] Seeker gets seeker tools, employer gets employer tools
- [ ] Chat still works without tools when flag is off (no regression)
- [ ] All tests from Task 3.1 PASS

---

## Phase 4: Quality Gates

### Task 4.1: Security & Coverage Verification

**Status:** 🔴 Blocked by 2.2, 2.4, 3.2
**Effort:** 1 hour
**Dependencies:** All implementation tasks

**Description:**
Final verification: ownership checks, no cross-user leaks, coverage ≥80%.

**Acceptance Criteria:**

- [ ] Every tool query filters by authenticated user's ID
- [ ] No tool returns other users' private settings
- [ ] `pnpm test` passes with zero failures
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] 80%+ test coverage on chat-tools.ts

---

## Dependency Graph

```
1.1 Feature Flag
  └─ blocks: 2.1, 2.3

2.1 Seeker Tests → 2.2 Seeker Impl   ┐
2.3 Employer Tests → 2.4 Employer Impl├─ both block: 3.1
                                      ┘
3.1 Route Tests → 3.2 Route Impl → 4.1 Verification
```

## Critical Path

```
1.1 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1
15m   2h    2.5h  1.5h   1h    1h  = 8.25 hours
```

**Parallelization:** Tasks 2.3/2.4 (employer) run parallel to 2.1/2.2 (seeker). Saves ~4 hours.

## Task Summary

| Phase                | Tasks | Effort     |
| -------------------- | ----- | ---------- |
| 1. Foundation        | 1     | 15m        |
| 2. Tool Definitions  | 4     | 8.5h       |
| 3. Route Integration | 2     | 2.5h       |
| 4. Quality Gates     | 1     | 1h         |
| **Total**            | **8** | **12.25h** |
