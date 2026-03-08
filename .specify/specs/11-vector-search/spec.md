# Feature 11: Vector Search

**Branch:** 11-vector-search
**Status:** Draft
**Priority:** P1
**Phase:** 2 (Beta)
**Dependencies:** 5-basic-ai-matching, 9-agent-to-agent-conversations

---

## Overview

Enable semantic matching between job seeker profiles and job postings using vector embeddings. Instead of relying solely on keyword overlap or manual filtering, the system generates embeddings for profiles and postings, then uses cosine similarity to build a ranked candidate shortlist. The Employer Agent uses this shortlist to determine which candidates to evaluate via agent-to-agent conversations, replacing the current naive "evaluate all candidates" approach.

**Business Value:** Reduces unnecessary agent conversations (saving BYOK costs), improves match quality by surfacing semantically relevant candidates first, and scales to larger candidate pools without linear cost growth.

---

## User Stories

### User Story 1: Automatic Embedding Generation

**As a** job seeker
**I want** my profile to be automatically indexed for semantic search when I create or update it
**So that** I am discoverable by employers whose postings match my skills and experience

**Acceptance Criteria:**

- [ ] An embedding is generated automatically when a profile is created or substantially updated
- [ ] The embedding captures skills, experience, headline, and location semantically
- [ ] Embedding generation uses the user's own BYOK API key
- [ ] If embedding generation fails (e.g., invalid API key), the profile remains usable without search indexing
- [ ] The user is not blocked or delayed by embedding generation (it happens asynchronously)

**Priority:** High

---

### User Story 2: Job Posting Embedding

**As an** employer
**I want** my job posting to be automatically indexed when I publish or update it
**So that** the system can find semantically relevant candidates

**Acceptance Criteria:**

- [ ] An embedding is generated when a job posting transitions to ACTIVE status
- [ ] The embedding captures title, description, required skills, experience level, and location type
- [ ] Embedding generation uses the employer's BYOK API key
- [ ] If embedding generation fails, the posting can still trigger conversations using fallback matching
- [ ] Embedding is regenerated when the posting is substantially edited

**Priority:** High

---

### User Story 3: Semantic Candidate Discovery

**As an** employer
**I want** the system to find the most relevant candidates for my posting using semantic similarity
**So that** agent conversations are focused on high-potential matches rather than random candidates

**Acceptance Criteria:**

- [ ] When matching is triggered, the system retrieves top-N candidates ranked by semantic similarity
- [ ] Only candidates with a similarity score above a configurable threshold are included
- [ ] Candidates who have already been evaluated for this posting are excluded
- [ ] The candidate shortlist is passed to the agent conversation workflow
- [ ] The system falls back to the existing matching approach if no embeddings are available

**Priority:** High

---

### User Story 4: Embedding Freshness

**As a** job seeker
**I want** my embedding to stay current as I update my profile
**So that** I am matched based on my latest skills and experience

**Acceptance Criteria:**

- [ ] Embedding is regenerated when profile fields that affect matching are updated (skills, experience, headline)
- [ ] Minor profile edits (e.g., avatar, bio) do not trigger re-embedding
- [ ] Stale embeddings (older than a configurable age) are flagged for regeneration
- [ ] Re-embedding does not disrupt ongoing conversations or existing matches

**Priority:** Medium

---

### User Story 5: Search Transparency

**As an** employer
**I want** to see how many candidates were considered and how they were ranked
**So that** I understand the matching process

**Acceptance Criteria:**

- [ ] Workflow status includes the number of candidates in the semantic shortlist
- [ ] The similarity score is available internally for debugging and tuning (not exposed to end users)
- [ ] If fallback matching was used (no embeddings), this is indicated in workflow status

**Priority:** Low

---

## Functional Requirements

### FR-001: Embedding Generation

The system must generate vector embeddings from structured text representations of profiles and postings using the entity owner's BYOK API key.

### FR-002: Embedding Storage

Embeddings must be stored alongside the source entity (job seeker profile or job posting) in a format that supports efficient similarity queries.

### FR-003: Similarity Search

The system must perform cosine similarity search to find the top-N most similar candidates for a given job posting embedding.

### FR-004: Shortlist Integration

The candidate shortlist from similarity search must replace or augment the existing candidate selection logic in the matching workflow.

### FR-005: Embedding Lifecycle

Embeddings must be regenerated when the source entity is substantially updated. Deletion of the source entity must cascade to the embedding.

### FR-006: Fallback Behavior

If embeddings are unavailable (generation failed, BYOK key missing, or pgvector unavailable), the system must fall back to the existing matching approach without error.

### FR-007: Exclusion of Previously Evaluated Candidates

Similarity search must exclude candidates who already have a completed conversation (COMPLETED_MATCH, COMPLETED_NO_MATCH, or TERMINATED) for the given job posting.

### FR-008: Configurable Parameters

The system must support configurable parameters: top-N shortlist size, minimum similarity threshold, and maximum embedding age before regeneration.

### FR-009: Asynchronous Generation

Embedding generation must not block user-facing operations. It should run as a background job (Inngest function).

---

## Non-Functional Requirements

### NFR-001: Performance

- Similarity search must return results in < 200ms for up to 10,000 candidate profiles
- Embedding generation must complete within 5 seconds per entity

### NFR-002: Cost Efficiency

- Embeddings should be generated only when necessary (on create/significant update, not on every page load)
- A single embedding per entity (not per-field)

### NFR-003: Security

- BYOK keys used for embedding generation follow the same encryption and handling rules as conversation keys
- Embeddings themselves are not considered PII but must be deleted when the source entity is deleted

### NFR-004: Reliability

- Embedding generation failures must not prevent profile/posting creation or updates
- Failed embedding generation should be retried automatically (up to 3 times)

---

## Edge Cases & Error Handling

### EC-001: BYOK Key Invalid or Expired

If the user's API key is invalid when embedding generation is attempted, log the failure, skip embedding, and continue with non-vector matching. Do not notify the user unless they explicitly check embedding status.

### EC-002: Provider Mismatch for Embeddings

Different BYOK providers (OpenAI vs Anthropic) produce different embedding formats. The system must normalize embeddings to a consistent dimensionality or restrict to a single embedding provider.

### EC-003: Empty or Minimal Profile

If a profile has insufficient content to generate a meaningful embedding (e.g., only a name, no skills or experience), skip embedding generation and flag the profile as "not indexed."

### EC-004: Concurrent Updates

If a profile is updated while an embedding generation job is in progress, the system should detect staleness and regenerate after the current job completes.

### EC-005: Large Candidate Pools

For postings where similarity search returns more than the top-N threshold, only the top-N candidates should proceed to agent conversations. The rest are not evaluated.

### EC-006: Embedding Dimension Changes

If the embedding model changes (e.g., switching from text-embedding-3-small to text-embedding-3-large), existing embeddings become incompatible. The system must support bulk re-embedding migration.

---

## Success Metrics

- **Conversation efficiency:** ≥ 30% reduction in agent conversations that result in NO_MATCH (compared to evaluating all candidates)
- **Search latency:** p95 similarity search < 200ms
- **Embedding coverage:** ≥ 90% of active profiles and postings have valid embeddings
- **Fallback rate:** < 10% of matching workflows use fallback (non-vector) matching after feature is fully rolled out

---

## Out of Scope

- Full-text search or keyword-based search (this feature is vector-only)
- User-facing search UI (employers do not manually search; the system searches automatically)
- Cross-posting semantic deduplication
- Embedding-based recommendations outside of the matching workflow
