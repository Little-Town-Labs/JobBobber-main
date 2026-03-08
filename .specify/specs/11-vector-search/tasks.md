# Tasks — 11-vector-search

**Feature:** Vector Search for Semantic Candidate Discovery
**Plan:** `.specify/specs/11-vector-search/plan.md`
**Branch:** 11-vector-search

---

## Phase 1: Embedding Core (Foundation)

### Task 1.1: Schema Migration

**Status:** 🟡 Ready
**Effort:** 1 hour
**Dependencies:** None

**Description:**
Add `embeddingUpdatedAt` fields to JobSeeker and JobPosting models in Prisma schema. Create raw SQL migration for pgvector IVFFlat indexes.

**Acceptance Criteria:**

- [ ] `embeddingUpdatedAt DateTime?` added to JobSeeker model
- [ ] `embeddingUpdatedAt DateTime?` added to JobPosting model
- [ ] Raw SQL migration creates IVFFlat index on `profile_embedding` (lists=100)
- [ ] Raw SQL migration creates IVFFlat index on `job_embedding` (lists=50)
- [ ] `pnpm db:generate` succeeds

---

### Task 1.2: Embedding Module - Tests

**Status:** 🟡 Ready
**Effort:** 2 hours
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Write tests for `src/lib/embeddings.ts`. Cover `buildProfileText()`, `buildPostingText()`, `generateEmbedding()` (mocked OpenAI), and `findSimilarCandidates()` (mocked `db.$queryRaw`). **TESTS FIRST (TDD).**

**Acceptance Criteria:**

- [ ] `buildProfileText()` tests: structured output, truncation at 8000 chars, empty string for insufficient content
- [ ] `buildPostingText()` tests: structured output, all fields included, truncation
- [ ] `generateEmbedding()` tests: returns 1536-d vector on success, returns null on failure, retries on transient errors
- [ ] `findSimilarCandidates()` tests: returns sorted results, excludes candidates with existing conversations, excludes candidates without embeddings, respects limit and minSimilarity
- [ ] Zod schema tests for embedding configuration
- [ ] All tests confirmed to FAIL (RED phase)

---

### Task 1.3: Embedding Module - Implementation

**Status:** 🔴 Blocked by 1.2
**Effort:** 3 hours
**Dependencies:** Task 1.1, Task 1.2

**Description:**
Implement `src/lib/embeddings.ts` with `generateEmbedding()`, `buildProfileText()`, `buildPostingText()`, `findSimilarCandidates()`, and Zod configuration schemas.

**Acceptance Criteria:**

- [ ] All tests from Task 1.2 pass (GREEN phase)
- [ ] `generateEmbedding()` calls OpenAI text-embedding-3-small with BYOK key
- [ ] `generateEmbedding()` retries up to 2 times on transient failures, returns null on permanent failures
- [ ] `buildProfileText()` produces structured template: Title, Skills, Experience, Education, Location
- [ ] `buildPostingText()` produces structured template: Title, Description, Required Skills, Experience Level, Employment Type, Location, Salary Range
- [ ] `findSimilarCandidates()` uses parameterized `db.$queryRaw` with cosine distance operator
- [ ] Embedding constants exported: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `DEFAULT_SHORTLIST_SIZE`, `MIN_SIMILARITY_THRESHOLD`

---

## Phase 2: Inngest Functions

### Task 2.1: Profile Embedding Function - Tests

**Status:** 🔴 Blocked by 1.3
**Effort:** 1.5 hours
**Dependencies:** Task 1.3

**Description:**
Write tests for `src/server/inngest/functions/generate-profile-embedding.ts`. Mock OpenAI API and database. **TESTS FIRST (TDD).**

**Acceptance Criteria:**

- [ ] Tests: fetches seeker profile, builds text, generates embedding, updates database
- [ ] Tests: decrypts BYOK OpenAI key per-use
- [ ] Tests: skips if seeker has no OpenAI key (Anthropic-only user)
- [ ] Tests: handles API failure gracefully (retries, then logs error)
- [ ] Tests: updates `embeddingUpdatedAt` timestamp on success
- [ ] All tests confirmed to FAIL

---

### Task 2.2: Profile Embedding Function - Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2 hours
**Dependencies:** Task 2.1

**Description:**
Implement `generate-profile-embedding` Inngest function triggered by `embeddings/profile.updated` event.

**Acceptance Criteria:**

- [ ] All tests from Task 2.1 pass
- [ ] Triggered by `embeddings/profile.updated` event with `{ seekerId }` data
- [ ] Fetches seeker profile and employer's OpenAI BYOK key
- [ ] Calls `buildProfileText()` and `generateEmbedding()`
- [ ] Updates `profileEmbedding` and `embeddingUpdatedAt` via raw SQL
- [ ] Skips gracefully if no OpenAI key available

---

### Task 2.3: Posting Embedding Function - Tests

**Status:** 🔴 Blocked by 1.3
**Effort:** 1.5 hours
**Dependencies:** Task 1.3
**Parallel with:** Task 2.1

**Description:**
Write tests for `src/server/inngest/functions/generate-posting-embedding.ts`. **TESTS FIRST (TDD).**

**Acceptance Criteria:**

- [ ] Tests: fetches posting, builds text, generates embedding, updates database
- [ ] Tests: decrypts employer's BYOK OpenAI key
- [ ] Tests: skips if employer has no OpenAI key
- [ ] Tests: updates `embeddingUpdatedAt` on success
- [ ] Tests: handles missing posting gracefully
- [ ] All tests confirmed to FAIL

---

### Task 2.4: Posting Embedding Function - Implementation

**Status:** 🔴 Blocked by 2.3
**Effort:** 2 hours
**Dependencies:** Task 2.3

**Description:**
Implement `generate-posting-embedding` Inngest function triggered by `embeddings/posting.activated` event.

**Acceptance Criteria:**

- [ ] All tests from Task 2.3 pass
- [ ] Triggered by `embeddings/posting.activated` event with `{ jobPostingId, employerId }` data
- [ ] Fetches posting and employer's OpenAI BYOK key
- [ ] Calls `buildPostingText()` and `generateEmbedding()`
- [ ] Updates `jobEmbedding` and `embeddingUpdatedAt` via raw SQL
- [ ] Skips gracefully if no OpenAI key available

---

## Phase 3: Pipeline Integration

### Task 3.1: Evaluate Candidates Integration - Tests

**Status:** 🔴 Blocked by 1.3
**Effort:** 2 hours
**Dependencies:** Task 1.3
**Parallel with:** Task 2.1, Task 2.3

**Description:**
Write tests for modified `evaluate-candidates.ts` that uses vector shortlist. **TESTS FIRST (TDD).**

**Acceptance Criteria:**

- [ ] Tests: uses `findSimilarCandidates()` when posting has embedding and `VECTOR_SEARCH` flag is on
- [ ] Tests: falls back to "all candidates" approach when posting has no embedding
- [ ] Tests: falls back when `VECTOR_SEARCH` flag is off
- [ ] Tests: workflow status includes shortlist size and search mode (vector vs. fallback)
- [ ] Tests: dispatches conversations only for shortlisted candidates
- [ ] All tests confirmed to FAIL

---

### Task 3.2: Evaluate Candidates Integration - Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 2 hours
**Dependencies:** Task 3.1

**Description:**
Modify `evaluate-candidates.ts` to use `findSimilarCandidates()` for candidate selection when vector search is available.

**Acceptance Criteria:**

- [ ] All tests from Task 3.1 pass
- [ ] Checks `VECTOR_SEARCH` feature flag before using vector search
- [ ] Calls `findSimilarCandidates()` with posting's `jobEmbedding` when available
- [ ] Falls back to existing "all candidates" approach when no embedding or flag off
- [ ] Logs search mode and shortlist size for observability

---

### Task 3.3: Event Wiring

**Status:** 🔴 Blocked by 2.2, 2.4
**Effort:** 1 hour
**Dependencies:** Task 2.2, Task 2.4

**Description:**
Wire embedding generation triggers into existing workflows. Emit `embeddings/profile.updated` on profile changes and `embeddings/posting.activated` on posting activation.

**Acceptance Criteria:**

- [ ] Profile create/update emits `embeddings/profile.updated` event
- [ ] Posting activation emits `embeddings/posting.activated` event
- [ ] New Inngest functions registered in the Inngest client export
- [ ] Events use correct data shapes per contract

---

## Phase 4: Testing & Quality

### Task 4.1: Integration Tests

**Status:** 🔴 Blocked by 3.2, 3.3
**Effort:** 2 hours
**Dependencies:** Task 3.2, Task 3.3

**Description:**
Write integration tests for the full vector search pipeline.

**Acceptance Criteria:**

- [ ] Test: profile update → embedding generation → similarity search returns relevant candidates
- [ ] Test: posting activation → embedding generation → evaluate-candidates uses shortlist
- [ ] Test: fallback behavior when no embedding available
- [ ] Test: fallback behavior for Anthropic-only user (no OpenAI key)
- [ ] All integration tests pass

---

### Task 4.2: Code Review

**Status:** 🔴 Blocked by 4.1
**Effort:** 1 hour
**Dependencies:** Task 4.1

**Description:**
Run code review on all new code.

**Acceptance Criteria:**

- [ ] No CRITICAL or HIGH issues
- [ ] All raw SQL uses parameterized queries (no interpolation)
- [ ] BYOK keys decrypted per-use, never serialized
- [ ] No hardcoded secrets
- [ ] Code follows existing codebase patterns

---

### Task 4.3: Security Review

**Status:** 🔴 Blocked by 4.1
**Effort:** 1 hour
**Dependencies:** Task 4.1
**Parallel with:** Task 4.2

**Description:**
Run security review focused on SQL injection, BYOK key handling, and embedding data privacy.

**Acceptance Criteria:**

- [ ] All `$queryRaw` calls use parameterized queries (`$1`, `$2`)
- [ ] BYOK keys follow existing decryption pattern (per-use, not cached)
- [ ] Embeddings cascade-deleted with source entity
- [ ] No PII exposure through embedding vectors
- [ ] OWASP Top 10 check passed for new code

---

## Summary

- **Total Tasks:** 15
- **Phases:** 4
- **Total Effort:** 22 hours
- **Estimated Duration:** ~12 hours with parallelization

### Parallelization Opportunities

- Phase 1: Tasks 1.1 and 1.2 parallel (schema vs tests)
- Phase 2: Tasks 2.1 and 2.3 parallel (profile vs posting embedding tests)
- Phase 3: Task 3.1 parallel with 2.1, 2.3 (only depends on 1.3)
- Phase 4: Tasks 4.2 and 4.3 parallel (code review vs security review)

### Critical Path

Task 1.2 → 1.3 → 2.1 → 2.2 → 3.3 → 4.1 → 4.2
**Duration:** ~13.5 hours on critical path

### Quality Gates

- [ ] TDD enforced (tests before implementation)
- [ ] Security review at checkpoint (Task 4.3)
- [ ] Code review before merge (Task 4.2)
- [ ] Integration tests validate full pipeline (Task 4.1)
- [ ] All raw SQL parameterized (no injection vectors)
- [ ] BYOK compliance maintained
