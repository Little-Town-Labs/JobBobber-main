# Feature 7: Testing Infrastructure — Implementation Plan

**Branch:** 7-testing-infrastructure
**Spec:** .specify/specs/7-testing-infrastructure/spec.md
**Created:** 2026-03-06

---

## Executive Summary

Harden the existing testing infrastructure by adding shared LLM mock utilities, test scaffolding helpers, CI coverage enforcement, E2E critical-flow tests, and a pre-commit test gate. The project already has Vitest (with 80% thresholds), Playwright, a GitHub Actions CI pipeline, and lint-staged. This plan fills the remaining gaps.

---

## Architecture Overview

```
tests/
  helpers/
    llm-mock.ts          # Shared LLM mock factory (US-1)
    create-context.ts     # tRPC context factories (US-2)
    create-entities.ts    # Prisma entity factories (US-2)
    index.ts              # Re-exports
  e2e/
    auth-redirect.spec.ts       # US-4
    seeker-dashboard.spec.ts    # US-4
    employer-matches.spec.ts    # US-4
    match-actions.spec.ts       # US-4
    fixtures/
      auth.ts                   # Clerk auth fixture
      seed.ts                   # DB seed helper
  setup.ts               # (existing, unchanged)
```

No new database entities. No new API routes. No new UI pages.

---

## Technical Decisions

### TD-1: LLM Mock Approach

**Context:** AI tests currently mock `generateObject` ad-hoc per test file.
**Options:**

1. **Shared mock factory in `tests/helpers/llm-mock.ts`** — centralizes configuration, returns Zod-valid responses
2. **MSW (Mock Service Worker)** — intercepts HTTP requests at network level

**Chosen:** Option 1 (shared mock factory)
**Rationale:** The project uses Vercel AI SDK's `generateObject`, which is a function call, not a raw HTTP request. Mocking the function directly is simpler and more type-safe. MSW would require mocking at the provider HTTP level, adding complexity for no benefit.
**Tradeoffs:** Tests are coupled to the Vercel AI SDK function signature. Acceptable since the SDK is already a project-wide dependency.

### TD-2: E2E Authentication Strategy

**Context:** E2E tests need authenticated sessions. Clerk is the auth provider.
**Options:**

1. **Clerk Testing Tokens** — use `@clerk/testing` package for test-mode auth
2. **Mock auth at middleware level** — bypass Clerk entirely in E2E with an env flag
3. **Seeded test users** — create real Clerk test users, store session cookies

**Chosen:** Option 2 (mock auth at middleware)
**Rationale:** E2E tests must not depend on external services (NFR-3, NFR-5). Clerk Testing Tokens require a live Clerk instance. A simple `TEST_AUTH_USER_ID` env var checked in middleware enables deterministic, offline E2E tests.
**Tradeoffs:** E2E tests don't exercise real Clerk flows. Acceptable — Clerk's own auth flow is their responsibility; our E2E tests focus on application behavior post-auth.

### TD-3: Pre-Commit Test Strategy

**Context:** lint-staged currently runs prettier + eslint. Adding full test suite would be slow.
**Options:**

1. **Run affected tests only** — use `vitest related` to test only changed files
2. **Run full suite** — `vitest run`
3. **Type-check only** — `tsc --noEmit` (fast, catches many issues)

**Chosen:** Option 1 (`vitest related`)
**Rationale:** Fast (<30s for typical changes) while still catching regressions in modified code. Full suite runs in CI; pre-commit is a fast guard.
**Tradeoffs:** Won't catch transitive regressions from changes to shared utilities. Acceptable since CI catches those.

### TD-4: Test Entity Factory Approach

**Context:** Tests create mock Prisma objects with verbose inline literals.
**Options:**

1. **Simple factory functions** — `createMockJobSeeker(overrides)` returning plain objects
2. **Fishery/FactoryBot-style library** — brings traits, sequences, associations

**Chosen:** Option 1 (simple factory functions)
**Rationale:** Constitutional principle IV (Minimal Abstractions). The project has ~6 entities. Simple functions with spread overrides are sufficient and have zero dependencies.
**Tradeoffs:** No automatic sequences or association building. Acceptable at current scale.

---

## Implementation Phases

### Phase 1: Test Helpers (US-1, US-2)

1. Create `tests/helpers/llm-mock.ts` — shared `mockGenerateObject()` factory
   - Accepts optional config: `{ score, reasoning, error }`
   - Returns Zod-valid `agentEvaluationSchema` response by default
   - Supports error simulation (rate limit, timeout, invalid key)
2. Create `tests/helpers/create-context.ts` — tRPC context factories
   - `createMockSeekerContext()`, `createMockEmployerContext()`, etc.
   - Uses existing `testHelpers` from `src/server/api/trpc.ts` as reference
3. Create `tests/helpers/create-entities.ts` — Prisma entity factories
   - `createMockJobSeeker(overrides)`, `createMockEmployer(overrides)`, etc.
   - All factories return objects matching Prisma types with sensible defaults
4. Create `tests/helpers/index.ts` — barrel re-export
5. Refactor 3+ existing test files to use shared helpers

### Phase 2: CI Coverage Enforcement (US-3)

1. Verify vitest `thresholds` config causes non-zero exit on failure (it should — vitest exits 1 when thresholds unmet)
2. Add explicit coverage threshold failure test in CI config comments
3. Ensure `pnpm test:coverage` is the command used in CI (already is)
4. Document local coverage check in contributing guide or README

### Phase 3: E2E Critical Flows (US-4)

1. Create `tests/e2e/fixtures/auth.ts` — Playwright fixture that sets `TEST_AUTH_USER_ID` cookie/header
2. Create `tests/e2e/fixtures/seed.ts` — seeds test database with known entities
3. Add middleware check: if `process.env.TEST_AUTH_USER_ID` is set in test env, use it as the auth identity
4. Write E2E tests:
   - `auth-redirect.spec.ts` — unauthenticated user redirected to sign-in
   - `seeker-dashboard.spec.ts` — seeker views matches
   - `employer-matches.spec.ts` — employer views posting matches
   - `match-actions.spec.ts` — accept/decline updates UI
5. Add E2E job to CI (optional — can be deferred if Playwright CI setup is complex)

### Phase 4: Pre-Commit Test Gate (US-5)

1. Add `vitest related` to lint-staged config in `package.json`
2. Configure timeout/warning behavior
3. Document bypass flag (`--no-verify`)

---

## Security Considerations

- `TEST_AUTH_USER_ID` env var must ONLY be checked when `NODE_ENV === 'test'` — never in production
- No real API keys, Clerk secrets, or production data in any test fixture
- E2E seed data uses obviously fake values (test@example.com, not real emails)

---

## Performance Strategy

- LLM mock factory is synchronous — zero network overhead
- `vitest related` for pre-commit keeps hook under 30s
- E2E tests use Playwright's parallel mode (`fullyParallel: true` already configured)
- CI unit tests target <60s, E2E <5 min

---

## Testing Strategy

This feature IS the testing strategy. Meta-testing approach:

- LLM mock utility tested by a small test that verifies it returns valid Zod-parsed output
- Entity factories tested by verifying they produce objects assignable to Prisma types
- CI enforcement verified by temporarily lowering a threshold and confirming failure

---

## Risks & Mitigation

| Risk                                                             | Impact | Mitigation                                                          |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| E2E auth mock introduces security hole                           | High   | Guard `TEST_AUTH_USER_ID` behind strict `NODE_ENV === 'test'` check |
| Pre-commit hook too slow                                         | Medium | Use `vitest related` (not full suite); add 30s timeout              |
| Refactoring existing tests to use helpers introduces regressions | Low    | Run full test suite after each refactored file                      |

---

## Constitutional Compliance

- [x] **I. Type Safety** — Factories return Prisma-typed objects; LLM mock returns Zod-valid responses
- [x] **II. TDD** — This feature directly supports and enforces TDD
- [x] **III. BYOK** — No real API keys in tests
- [x] **IV. Minimal Abstractions** — Simple factory functions, no library dependencies
- [x] **V. Security & Privacy** — Test auth guard scoped to test env only
- [x] **VI. Feature Flags** — Not applicable
- [x] **VII. Agent Autonomy** — Not applicable
