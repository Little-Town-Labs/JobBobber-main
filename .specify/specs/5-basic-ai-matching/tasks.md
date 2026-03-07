# Task Breakdown — 5-basic-ai-matching

**Branch:** 5-basic-ai-matching
**Plan:** .specify/specs/5-basic-ai-matching/plan.md
**Date:** 2026-03-05

---

## Phase 1: Agent Core

### Task 1.1: Matching Schemas & Agent Evaluation — Tests

**Status:** 🟡 Ready
**Effort:** 3 hours
**Dependencies:** None

**Description:**
Write tests for the evaluation Zod schemas, score-to-confidence mapping, prompt builder, and `evaluateCandidate` function. Mock `generateObject` from the `ai` package. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for `agentEvaluationSchema` — valid input passes, invalid rejects (score out of range, missing fields)
- [ ] Tests for `scoreToConfidence` — STRONG (70-100), GOOD (50-69), POTENTIAL (30-49), null (<30)
- [ ] Tests for `buildEvaluationPrompt` — returns system + user messages with posting and candidate data
- [ ] Tests for `evaluateCandidate` — mocked `generateObject` returns valid evaluation
- [ ] Tests for `evaluateCandidate` — mocked `generateObject` returns invalid output → returns null
- [ ] Tests for `evaluateCandidate` — mocked `generateObject` throws error → returns null
- [ ] Tests for dynamic provider selection (openai vs anthropic)
- [ ] Agent system prompt includes anti-discrimination guardrails
- [ ] All tests confirmed to FAIL

---

### Task 1.2: Matching Schemas & Agent Evaluation — Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 3 hours
**Dependencies:** Task 1.1

**Description:**
Implement `src/lib/matching-schemas.ts` (Zod schemas) and `src/server/agents/employer-agent.ts` (evaluation logic).

**Acceptance Criteria:**

- [ ] `agentEvaluationSchema` validates score (0-100), confidence, matchSummary, strengthAreas, gapAreas
- [ ] `scoreToConfidence(score)` maps score bands correctly
- [ ] `buildEvaluationPrompt(posting, candidate)` returns typed prompt with guardrails
- [ ] `evaluateCandidate(posting, candidate, apiKey, provider)` calls `generateObject` with dynamic provider
- [ ] Returns `AgentEvaluation` on success, `null` on validation failure or error
- [ ] System prompt forbids consideration of protected characteristics
- [ ] Provider selection: `"openai"` → createOpenAI, `"anthropic"` → createAnthropic
- [ ] All tests from 1.1 pass

---

## Phase 2: Inngest Workflow

### Task 2.1: Evaluate Candidates Workflow — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 3 hours
**Dependencies:** Task 1.2

**Description:**
Write tests for the Inngest `evaluate-candidates` workflow. Mock the agent, Prisma, and encryption module. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Workflow fetches posting, employer, and decrypts BYOK key
- [ ] Workflow finds eligible candidates (active, has name, has skills)
- [ ] Workflow excludes candidates already matched for this posting
- [ ] Workflow calls `evaluateCandidate` for each eligible candidate
- [ ] Score >= 30 creates AgentConversation + Match records
- [ ] Score < 30 skips match creation
- [ ] Workflow handles missing BYOK key (terminates with FAILED status)
- [ ] Workflow handles LLM errors gracefully (skips candidate, continues)
- [ ] Workflow reports completion with counts (total, evaluated, matches, skipped)
- [ ] All tests confirmed to FAIL

---

### Task 2.2: Evaluate Candidates Workflow — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 5 hours
**Dependencies:** Task 2.1

**Description:**
Implement `src/server/inngest/functions/evaluate-candidates.ts` and register in function registry.

**Acceptance Criteria:**

- [ ] Inngest function triggered by `"matching/posting.activated"` event
- [ ] Step 1: Fetch posting + employer, decrypt BYOK key via `decrypt()`
- [ ] Step 2: Find eligible job seekers, exclude already-matched via AgentConversation lookup
- [ ] Step 3: Batch evaluate candidates (10 per batch), create records for score >= 30
- [ ] Match record: confidenceScore from `scoreToConfidence`, matchSummary from agent, both statuses PENDING
- [ ] AgentConversation record: status COMPLETED_MATCH or COMPLETED_NO_MATCH, messages contains evaluation
- [ ] Workflow state tracks progress (evaluatedCount, matchesCreated, skippedCount)
- [ ] Registered in `src/server/inngest/functions/index.ts`
- [ ] All tests from 2.1 pass

---

## Phase 3: Trigger Integration

### Task 3.1: Matching Trigger — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2

**Description:**
Write/update tests for the `updateStatus` procedure to verify it fires the Inngest event on DRAFT → ACTIVE. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] DRAFT → ACTIVE fires `"matching/posting.activated"` event with jobPostingId and employerId
- [ ] PAUSED → ACTIVE does NOT fire the matching event (MVP: no re-matching)
- [ ] Other transitions do not fire matching events
- [ ] Inngest send is called after successful status update (not inside transaction)
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 2.1

---

### Task 3.2: Matching Trigger — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1 hour
**Dependencies:** Task 3.1

**Description:**
Modify `src/server/api/routers/jobPostings.ts` updateStatus to send Inngest event.

**Acceptance Criteria:**

- [ ] After successful DRAFT → ACTIVE update, calls `ctx.inngest.send({ name: "matching/posting.activated", data: { jobPostingId, employerId } })`
- [ ] Only fires for DRAFT → ACTIVE (check previous status was DRAFT)
- [ ] Does not block the status update response
- [ ] All tests from 3.1 pass

**Parallel with:** Task 2.2

---

## Phase 4: Matches Router

### Task 4.1: Match Mapper & Router — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 3 hours
**Dependencies:** Task 1.2

**Description:**
Write tests for the match mapper and all 5 matches router procedures. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Match mapper: maps Prisma Match to response type, excludes seekerContactInfo when not mutual accept
- [ ] `listForPosting` — returns paginated matches for employer's posting, sorted by score desc
- [ ] `listForPosting` — rejects non-owner employer
- [ ] `listForSeeker` — returns paginated matches for authenticated seeker
- [ ] `getById` — returns match for owning seeker or employer
- [ ] `getById` — rejects unauthorized access
- [ ] `updateStatus` — employer accepts match (PENDING → ACCEPTED)
- [ ] `updateStatus` — seeker declines match (PENDING → DECLINED)
- [ ] `updateStatus` — rejects invalid transitions (ACCEPTED → DECLINED)
- [ ] `updateStatus` — mutual accept: both ACCEPTED → seekerContactInfo populated
- [ ] `getWorkflowStatus` — returns workflow progress for employer's posting
- [ ] All tests confirmed to FAIL

**Parallel with:** Tasks 2.1, 3.1

---

### Task 4.2: Match Mapper & Router — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 3 hours
**Dependencies:** Task 4.1

**Description:**
Implement `src/server/api/helpers/match-mapper.ts` and expand `src/server/api/routers/matches.ts`.

**Acceptance Criteria:**

- [ ] `toMatchResponse(match, isOwner)` maps fields, hides contact info unless mutual accept
- [ ] `listForPosting` — employerProcedure, ownership verified, cursor pagination, score desc
- [ ] `listForSeeker` — seekerProcedure, cursor pagination, createdAt desc
- [ ] `getById` — protectedProcedure, checks seeker or employer ownership
- [ ] `updateStatus` — validates PENDING → ACCEPTED/DECLINED only
- [ ] `updateStatus` — on mutual accept: populates seekerContactInfo from JobSeeker profile
- [ ] `getWorkflowStatus` — queries latest AgentConversation counts for the posting
- [ ] All tests from 4.1 pass

**Parallel with:** Tasks 2.2, 3.2

---

## Phase 5: Frontend — Match Views

### Task 5.1: Match Components — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 2 hours
**Dependencies:** Task 4.2

**Description:**
Write tests for MatchCard, MatchList, MatchDetail, and WorkflowStatus components. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] MatchCard renders score, confidence badge, candidate/company name, summary excerpt
- [ ] MatchList renders list of match cards with empty state
- [ ] MatchDetail renders full summary, strength areas, gap areas, accept/decline buttons
- [ ] MatchDetail shows contact info when mutual accept
- [ ] WorkflowStatus shows progress bar and status text
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 5.3

---

### Task 5.2: Match Components — Implementation

**Status:** 🔴 Blocked by 5.1
**Effort:** 3 hours
**Dependencies:** Task 5.1

**Description:**
Create match UI components.

**Acceptance Criteria:**

- [ ] `src/components/matches/match-card.tsx` — score, confidence badge (color-coded), name, summary
- [ ] `src/components/matches/match-list.tsx` — paginated list with empty state CTA
- [ ] `src/components/matches/match-detail.tsx` — full view with accept/decline actions
- [ ] `src/components/matches/workflow-status.tsx` — progress indicator (QUEUED/RUNNING/COMPLETED/FAILED)
- [ ] All tests from 5.1 pass

**Parallel with:** Task 5.4

---

### Task 5.3: Match Pages — Tests

**Status:** 🔴 Blocked by 4.2
**Effort:** 1.5 hours
**Dependencies:** Task 4.2

**Description:**
Write tests for employer match list page and seeker matches page. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Employer posting matches page renders match list and workflow status
- [ ] Seeker matches page renders match list
- [ ] Loading and error states render correctly
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 5.1

---

### Task 5.4: Match Pages — Implementation

**Status:** 🔴 Blocked by 5.2, 5.3
**Effort:** 2 hours
**Dependencies:** Tasks 5.2, 5.3

**Description:**
Create match view pages.

**Acceptance Criteria:**

- [ ] `src/app/(employer)/postings/[id]/matches/page.tsx` — employer match list with workflow status
- [ ] `src/app/(seeker)/matches/page.tsx` — seeker match list
- [ ] Loading and error boundary pages
- [ ] All tests from 5.3 pass

---

## Phase 6: Security & Hardening

### Task 6.1: Security Review

**Status:** 🔴 Blocked by 2.2, 3.2, 4.2
**Effort:** 2 hours
**Dependencies:** Tasks 2.2, 3.2, 4.2

**Description:**
Run security review on all new agent, workflow, and router code.

**Acceptance Criteria:**

- [ ] BYOK key never appears in logs, Inngest step output, or API responses
- [ ] Agent system prompt includes anti-discrimination guardrails
- [ ] `seekerContactInfo` only populated after mutual accept
- [ ] Private settings (SeekerSettings, JobSettings) never accessed
- [ ] No `console.log` in production code
- [ ] Error messages don't leak server internals
- [ ] TypeScript strict mode passes

---

## Phase 7: Integration & E2E Tests

### Task 7.1: Integration Tests

**Status:** 🔴 Blocked by 6.1
**Effort:** 3 hours
**Dependencies:** Task 6.1

**Description:**
Write integration tests against test database for matches router and workflow.

**Acceptance Criteria:**

- [ ] Create employer + posting + seekers → run workflow (mocked LLM) → verify Match records
- [ ] Match status transitions: accept, decline, mutual accept with contact reveal
- [ ] `listForPosting` returns correct matches sorted by score
- [ ] `listForSeeker` returns correct matches for authenticated seeker
- [ ] Duplicate workflow run doesn't create duplicate matches

---

### Task 7.2: E2E Tests

**Status:** 🔴 Blocked by 7.1
**Effort:** 2 hours
**Dependencies:** Task 7.1

**Description:**
Write Playwright E2E tests for critical matching flows.

**Acceptance Criteria:**

- [ ] Employer activates posting → sees workflow status → reviews matches
- [ ] Seeker views match list → accepts match
- [ ] Both accept → contact info revealed

---

### Task 7.3: Code Review

**Status:** 🔴 Blocked by 5.4, 6.1
**Effort:** 1.5 hours
**Dependencies:** Tasks 5.4, 6.1

**Description:**
Run code review on all Feature 5 code.

**Acceptance Criteria:**

- [ ] No CRITICAL or HIGH issues remaining
- [ ] Code follows existing codebase patterns
- [ ] No unused imports or dead code

---

## Summary

- **Total Tasks:** 18
- **Phases:** 7
- **Total Effort:** ~38 hours
- **Estimated Duration:** ~5 days (with parallelization)

### Parallelization Opportunities

- Phase 2/3: Tasks 2.1 and 3.1 parallel (independent test suites)
- Phase 2/3/4: Tasks 2.2, 3.2, 4.2 parallel (independent implementations)
- Phase 4: Task 4.1 parallel with 2.1 and 3.1
- Phase 5: Tasks 5.1/5.3 parallel (components vs pages tests)

### Critical Path

Task 1.1 → 1.2 → 2.1 → 2.2 → 6.1 → 7.1 → 7.2
**Duration:** ~22 hours on critical path

### Quality Gates

- [ ] TDD enforced (tests before implementation)
- [ ] Security review at Phase 6
- [ ] Code review before merge (Task 7.3)
- [ ] Integration tests validate all user stories
- [ ] BYOK key verified absent from all outputs

### User Story → Task Mapping

| User Story                       | Tasks              |
| -------------------------------- | ------------------ |
| US1: Employer Activates Matching | 2.1, 2.2, 3.1, 3.2 |
| US2: Employer Reviews Matches    | 4.1, 4.2, 5.1-5.4  |
| US3: Seeker Receives Matches     | 4.1, 4.2, 5.1-5.4  |
| US4: Mutual Accept               | 4.1, 4.2           |
| US5: Ethical Guardrails          | 1.1, 1.2           |
| US6: Error Handling              | 2.1, 2.2           |
