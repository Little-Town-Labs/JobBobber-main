# Feature 7: Testing Infrastructure — Task Breakdown

**Branch:** 7-testing-infrastructure
**Plan:** .specify/specs/7-testing-infrastructure/plan.md
**Created:** 2026-03-06

---

## Phase 1: Test Helpers (US-1, US-2)

### Task 1.1: LLM Mock Factory — Tests

**Status:** ✅ Completed
**Effort:** 1h
**Dependencies:** None
**Parallel with:** Task 1.3

**Description:**
Write tests for the shared LLM mock factory (`tests/helpers/llm-mock.ts`). **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: default call returns Zod-valid `agentEvaluationSchema` response
- [ ] Test: custom config overrides score, reasoning, confidence
- [ ] Test: error simulation (rate limit, timeout, invalid key) returns appropriate errors
- [ ] Test: validates model identifier is non-empty string
- [ ] Tests confirmed to FAIL

---

### Task 1.2: LLM Mock Factory — Implementation

**Status:** ✅ Completed
**Effort:** 1h
**Dependencies:** Task 1.1

**Description:**
Implement `tests/helpers/llm-mock.ts` to pass tests from Task 1.1.

**Acceptance Criteria:**

- [ ] All tests from 1.1 pass
- [ ] Exports `createMockGenerateObject(config?)` function
- [ ] Default response matches `agentEvaluationSchema` Zod schema
- [ ] Supports `{ score, reasoning, error }` config overrides

---

### Task 1.3: Entity & Context Factories — Tests

**Status:** ✅ Completed
**Effort:** 1h
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Write tests for entity factories (`tests/helpers/create-entities.ts`) and tRPC context factories (`tests/helpers/create-context.ts`). **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: `createMockJobSeeker()` returns valid JobSeeker-shaped object with defaults
- [ ] Test: `createMockEmployer()` returns valid Employer-shaped object with defaults
- [ ] Test: `createMockJobPosting()` returns valid JobPosting-shaped object with defaults
- [ ] Test: `createMockMatch()` returns valid Match-shaped object with defaults
- [ ] Test: override fields merge correctly (spread, not replace)
- [ ] Test: `createMockSeekerContext()` returns object with `userId`, `seeker`, `db`
- [ ] Test: `createMockEmployerContext()` returns object with `userId`, `orgId`, `employer`, `db`
- [ ] Tests confirmed to FAIL

---

### Task 1.4: Entity & Context Factories — Implementation

**Status:** ✅ Completed
**Effort:** 1.5h
**Dependencies:** Task 1.3

**Description:**
Implement `tests/helpers/create-entities.ts`, `tests/helpers/create-context.ts`, and `tests/helpers/index.ts` barrel export.

**Acceptance Criteria:**

- [ ] All tests from 1.3 pass
- [ ] Factory functions use Prisma types for return values
- [ ] Sensible defaults (UUIDs, timestamps, non-empty strings)
- [ ] `index.ts` re-exports all helpers

---

### Task 1.5: Refactor Existing Tests to Use Helpers

**Status:** ✅ Completed
**Effort:** 1.5h
**Dependencies:** Tasks 1.2, 1.4

**Description:**
Refactor at least 3 existing test files to use the shared helpers instead of inline mock objects.

**Acceptance Criteria:**

- [ ] `src/server/agents/employer-agent.test.ts` uses `createMockGenerateObject`
- [ ] `tests/unit/server/api/trpc.test.ts` uses `createMockEmployer` / `createMockJobSeeker`
- [ ] `src/server/api/routers/matches.dashboard.test.ts` uses entity factories
- [ ] All refactored tests still pass
- [ ] No functional changes — only mock creation refactored

---

## Phase 2: CI Coverage Enforcement (US-3)

### Task 2.1: Verify CI Coverage Gate

**Status:** ✅ Completed
**Effort:** 0.5h
**Dependencies:** None
**Parallel with:** Phase 1

**Description:**
Verify that vitest coverage thresholds cause CI failure when unmet. Document findings.

**Acceptance Criteria:**

- [ ] Confirm `vitest run --coverage` exits non-zero when thresholds unmet (test locally by temporarily lowering a threshold)
- [ ] Confirm CI workflow uses `pnpm test:coverage` (already does)
- [ ] Add inline comment in CI workflow confirming threshold enforcement
- [ ] Document `pnpm test:coverage` as the local coverage check command

---

## Phase 3: E2E Critical Flows (US-4)

### Task 3.1: E2E Auth Fixtures — Tests

**Status:** ✅ Completed
**Effort:** 1h
**Dependencies:** Task 2.1

**Description:**
Write E2E test for auth redirect and create the auth fixture. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Test: unauthenticated visit to `/matches` redirects to sign-in page
- [ ] Test: authenticated visit to `/matches` renders the matches page
- [ ] Auth fixture sets `TEST_AUTH_USER_ID` for Playwright tests
- [ ] Tests confirmed to FAIL (fixture not yet wired to middleware)

---

### Task 3.2: E2E Auth Middleware Hook — Implementation

**Status:** ✅ Completed
**Effort:** 1h
**Dependencies:** Task 3.1

**Description:**
Add test-only auth bypass in middleware (guarded by `NODE_ENV === 'test'`). Create seed fixture.

**Acceptance Criteria:**

- [ ] Middleware checks `TEST_AUTH_USER_ID` only when `NODE_ENV === 'test'`
- [ ] `tests/e2e/fixtures/seed.ts` creates known seeker, employer, posting, match
- [ ] `tests/e2e/fixtures/auth.ts` provides Playwright `test.extend` with auth state
- [ ] Auth redirect E2E test from 3.1 passes
- [ ] Security: bypass CANNOT activate in production (`NODE_ENV !== 'test'`)

---

### Task 3.3: E2E Dashboard & Match Action Tests

**Status:** ✅ Completed
**Effort:** 1.5h
**Dependencies:** Task 3.2

**Description:**
Write remaining E2E tests for seeker dashboard, employer matches, and accept/decline actions.

**Acceptance Criteria:**

- [ ] `seeker-dashboard.spec.ts` — seeker sees match list with confidence scores
- [ ] `employer-matches.spec.ts` — employer sees candidates for a posting
- [ ] `match-actions.spec.ts` — accept/decline buttons update match card status
- [ ] All E2E tests pass against seeded test data
- [ ] No external service dependencies (Clerk, Resend, OpenAI)

---

## Phase 4: Pre-Commit Test Gate (US-5)

### Task 4.1: Add vitest related to lint-staged

**Status:** ✅ Completed
**Effort:** 0.5h
**Dependencies:** Task 1.5 (helpers must exist so related tests resolve)

**Description:**
Add `vitest related` to lint-staged config so changed `.ts/.tsx` files trigger their related tests before commit.

**Acceptance Criteria:**

- [ ] `lint-staged` config in `package.json` includes `vitest related --run` for `*.ts` / `*.tsx`
- [ ] Pre-commit hook completes in <30s for a typical single-file change
- [ ] Bypass documented: `git commit --no-verify`
- [ ] Existing prettier + eslint lint-staged rules preserved

---

## Phase 5: Quality Gate

### Task 5.1: Code Review & Security Check

**Status:** ✅ Completed
**Effort:** 0.5h
**Dependencies:** All implementation tasks

**Description:**
Review all new test infrastructure code for quality and security.

**Acceptance Criteria:**

- [ ] `TEST_AUTH_USER_ID` is strictly guarded behind `NODE_ENV === 'test'`
- [ ] No real secrets or API keys in any test file
- [ ] All new tests pass (`pnpm test`)
- [ ] E2E tests pass (`pnpm test:e2e`)
- [ ] Code review: no dead code, no unused imports

---

## Summary

| Metric                 | Value                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| Total Tasks            | 10                                                                            |
| Phases                 | 5                                                                             |
| Parallel Opportunities | Tasks 1.1+1.3 (LLM mock & entity factories), Task 2.1 (parallel with Phase 1) |

### Critical Path

`1.1 → 1.2 → 1.5 → 4.1 → 5.1`
and
`3.1 → 3.2 → 3.3 → 5.1`

### Dependency Graph

```
1.1 (LLM tests) ──→ 1.2 (LLM impl) ──┐
                                        ├──→ 1.5 (refactor) ──→ 4.1 (pre-commit) ──┐
1.3 (entity tests) → 1.4 (entity impl)─┘                                            │
                                                                                      ├→ 5.1 (review)
2.1 (CI verify) ──→ 3.1 (E2E auth tests) → 3.2 (E2E auth impl) → 3.3 (E2E flows) ──┘
```
