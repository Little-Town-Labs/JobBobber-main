# Feature 7: Testing Infrastructure

**Branch:** 7-testing-infrastructure
**Priority:** P0 (Constitutional Requirement)
**Status:** Draft
**Created:** 2026-03-06

---

## Overview

Harden the testing infrastructure so that every feature ships with confidence. The project already has Vitest, Playwright, a CI pipeline, and a pre-commit hook. This feature closes the remaining gaps: deterministic LLM mock utilities, test scaffolding helpers for common patterns, CI-enforced coverage gates, and end-to-end tests covering the critical user flows from authentication through match acceptance.

**Business Value:** Prevents regressions, enforces the 80 %+ coverage constitutional requirement, and ensures LLM-dependent features are testable without real API calls or non-deterministic output.

---

## User Stories

### US-1: Deterministic LLM Test Mocking

**As a** developer writing tests for AI-matching features
**I want** a shared mock utility that returns deterministic, configurable LLM responses
**So that** my tests are fast, repeatable, and never call a real LLM provider

**Acceptance Criteria:**

- [ ] A reusable mock factory exists that produces deterministic responses for any AI SDK call
- [ ] The mock can be configured per-test to return specific match scores, reasoning, or errors
- [ ] All existing AI-related tests use the shared mock (no ad-hoc inline mocks for LLM calls)
- [ ] The mock validates that the caller passes a valid model identifier and prompt

**Priority:** High

---

### US-2: Test Scaffolding Helpers

**As a** developer writing new feature tests
**I want** shared helper functions for common test setup patterns
**So that** I can write tests faster without duplicating boilerplate

**Acceptance Criteria:**

- [ ] Helpers exist for creating mock tRPC context (seeker, employer, admin, unauthenticated)
- [ ] Helpers exist for creating mock database entities (job seeker, employer, job posting, match)
- [ ] Helpers are type-safe and use the project's Prisma types
- [ ] At least 3 existing test files are refactored to use the shared helpers

**Priority:** High

---

### US-3: CI Coverage Enforcement

**As a** team lead
**I want** the CI pipeline to fail when test coverage drops below 80 %
**So that** no PR can merge without meeting the constitutional coverage requirement

**Acceptance Criteria:**

- [ ] CI test job exits non-zero when any coverage threshold (lines, functions, branches, statements) falls below 80 %
- [ ] Coverage report is uploaded as a CI artifact on every run
- [ ] A developer can check coverage locally with a single command before pushing

**Priority:** High

---

### US-4: E2E Tests for Critical User Flows

**As a** QA stakeholder
**I want** automated end-to-end tests covering the critical happy paths
**So that** regressions in the core user journey are caught before merge

**Acceptance Criteria:**

- [ ] E2E test: unauthenticated user is redirected to sign-in
- [ ] E2E test: authenticated seeker can view their matches dashboard
- [ ] E2E test: authenticated employer can view matches for a job posting
- [ ] E2E test: accept/decline actions update the match card status in the UI
- [ ] All E2E tests run against a seeded test database (no external dependencies)
- [ ] E2E tests can be run locally with `pnpm test:e2e` and in CI

**Priority:** Medium

---

### US-5: Pre-Commit Test Gate

**As a** developer
**I want** commits to be rejected if tests fail
**So that** broken code never enters the repository

**Acceptance Criteria:**

- [ ] Pre-commit hook runs the unit test suite (or a fast subset) before allowing a commit
- [ ] Hook runs in under 30 seconds on a typical developer machine
- [ ] Hook can be bypassed only with an explicit flag (documented in contributing guide)
- [ ] Lint-staged formatting continues to run alongside the test gate

**Priority:** Medium

---

## Functional Requirements

**FR-1:** LLM mock utility returns a configurable structured response matching the Zod schema used by the AI matching feature.

**FR-2:** LLM mock utility can simulate error conditions (rate limit, invalid API key, timeout).

**FR-3:** Test context helpers produce valid tRPC context objects for each procedure level (public, protected, seeker, employer, admin, onboarding).

**FR-4:** Test entity factories produce valid Prisma-compatible objects with sensible defaults and overridable fields.

**FR-5:** CI coverage job uses vitest `--coverage` with the existing 80 % thresholds and fails the build on violation.

**FR-6:** E2E tests use Playwright fixtures for authentication state (seeded Clerk test users or mocked auth).

**FR-7:** E2E tests seed the database before each test suite and clean up after.

---

## Non-Functional Requirements

**NFR-1 (Performance):** The full unit test suite completes in under 60 seconds on CI.

**NFR-2 (Performance):** E2E tests complete in under 5 minutes on CI.

**NFR-3 (Reliability):** Tests are deterministic — no flaky tests caused by timing, ordering, or external services.

**NFR-4 (Maintainability):** Mock utilities and helpers are co-located in a `tests/helpers/` directory with clear documentation.

**NFR-5 (Security):** No real API keys, secrets, or production data used in any test.

---

## Edge Cases & Error Handling

- **LLM mock called without configuration:** Returns a sensible default response (not an error) to prevent false negatives in unrelated tests.
- **Coverage threshold met globally but not per-file:** Only global thresholds are enforced; per-file thresholds are informational.
- **E2E test database connection failure:** Test suite fails fast with a clear error message rather than hanging.
- **Pre-commit hook timeout:** If the fast test subset exceeds 30 seconds, it logs a warning but does not block the commit (to avoid developer frustration).
- **Parallel test execution conflicts:** Database-touching integration tests use isolated transactions or separate schemas to avoid conflicts.

---

## Out of Scope

- Visual regression testing (screenshots, pixel diffing)
- Load / performance testing
- Contract testing with external services (Clerk, Stripe)
- Test data management for staging/production environments

---

## Success Metrics

- 80 %+ coverage enforced in CI (zero exceptions)
- All LLM-dependent tests use the shared mock utility
- E2E suite covers auth, profile, matching, and match acceptance flows
- No test depends on external services (Clerk, OpenAI, Resend) at runtime
- Pre-commit hook prevents commits with failing tests
