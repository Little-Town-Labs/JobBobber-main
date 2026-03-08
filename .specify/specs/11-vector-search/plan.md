# Implementation Plan — 11-vector-search

**Feature:** Vector Search for Semantic Candidate Discovery
**Specification:** `.specify/specs/11-vector-search/spec.md`
**Branch:** 11-vector-search

---

## Executive Summary

Add semantic search to the matching pipeline using pgvector embeddings. When a job posting is activated, the system generates an embedding from the posting text and uses cosine similarity to find the top-N most relevant candidates — replacing the current "evaluate all active candidates" approach. This reduces unnecessary agent conversations and improves match quality.

The infrastructure is already partially in place: the Prisma schema defines `profileEmbedding` and `jobEmbedding` vector columns, and NeonDB supports pgvector natively.

---

## Architecture Overview

```
Profile Update → Inngest: generate-profile-embedding → OpenAI Embedding API → UPDATE job_seekers SET profile_embedding
Posting ACTIVE → Inngest: generate-posting-embedding → OpenAI Embedding API → UPDATE job_postings SET job_embedding
                                                                            ↓
                                                              evaluate-candidates (modified)
                                                                            ↓
                                                         findSimilarCandidates(posting.jobEmbedding)
                                                                            ↓
                                                              pgvector cosine similarity query
                                                                            ↓
                                                         top-N candidate IDs → screen/dispatch conversations
```

### Component Layout

1. **`src/lib/embeddings.ts`** — Pure functions: `generateEmbedding()`, `buildProfileText()`, `buildPostingText()`, `findSimilarCandidates()`
2. **`src/server/inngest/functions/generate-profile-embedding.ts`** — Inngest function triggered on profile update
3. **`src/server/inngest/functions/generate-posting-embedding.ts`** — Inngest function triggered on posting activation
4. **`src/server/inngest/functions/evaluate-candidates.ts`** — Modified to use vector shortlist instead of fetching all candidates

---

## Technical Decisions

### TD-1: Embedding Model

**Chosen:** OpenAI text-embedding-3-small (1536 dimensions)
**Rationale:** Schema already uses `vector(1536)`. Cost-effective at $0.02/M tokens. BYOK-compatible (OpenAI users only).
**Tradeoffs:** Anthropic-only users fall back to non-vector matching.

### TD-2: Vector Search Backend

**Chosen:** pgvector with `db.$queryRaw` (cosine distance operator `<=>`)
**Rationale:** Already configured in schema. NeonDB supports it natively. No additional infrastructure.
**Tradeoffs:** Raw SQL queries (not type-safe), isolated to embeddings module.

### TD-3: Async Embedding Generation

**Chosen:** Inngest background jobs with retry
**Rationale:** Consistent with all other async work. Non-blocking. Built-in retry and observability.
**Tradeoffs:** Brief window without embedding after profile update (fallback handles this).

### TD-4: BYOK for Embeddings

**Chosen:** BYOK OpenAI keys only; fallback for Anthropic users
**Rationale:** Constitutional principle III is NON-NEGOTIABLE. Anthropic doesn't offer a standalone embedding API.
**Tradeoffs:** Anthropic-only users don't get vector search benefits.

---

## Implementation Phases

### Phase 1: Embedding Core (Foundation)

- Add `embeddingUpdatedAt` fields to JobSeeker and JobPosting models
- Create pgvector IVFFlat indexes via raw SQL migration
- Implement `src/lib/embeddings.ts`: `generateEmbedding()`, `buildProfileText()`, `buildPostingText()`
- Implement `findSimilarCandidates()` with pgvector raw SQL query
- Add Zod schemas for embedding configuration

### Phase 2: Inngest Functions

- Create `generate-profile-embedding` Inngest function
- Create `generate-posting-embedding` Inngest function
- Wire triggers: profile update events, posting activation events
- Add retry logic and error handling

### Phase 3: Pipeline Integration

- Modify `evaluate-candidates.ts` to use `findSimilarCandidates()` for candidate selection
- Add fallback: if posting has no embedding, use existing "all candidates" approach
- Update workflow status to include shortlist size and search mode
- Add `VECTOR_SEARCH` feature flag for gradual rollout

### Phase 4: Testing & Quality

- Unit tests for embedding text builders and similarity search
- Integration tests for the full pipeline (profile update → embedding → search → conversation dispatch)
- Test fallback behavior (no embedding, Anthropic user, pgvector unavailable)
- Code review and security review

---

## Security Considerations

- **BYOK keys**: Decrypted per-use in Inngest steps, never serialized. Same pattern as conversation workflow.
- **Embeddings are not PII**: Vector representations don't contain readable personal data. However, they must be deleted when the source entity is deleted (cascade).
- **Raw SQL injection**: All `$queryRaw` calls use parameterized queries (`$1`, `$2`). Never interpolate user input into SQL strings.
- **Rate limiting**: Embedding generation is throttled by Inngest concurrency limits. OpenAI rate limits handled by retry logic.

---

## Performance Strategy

- **IVFFlat index**: Approximate nearest neighbor search. O(sqrt(N)) probe cost. Handles 10K+ profiles with < 200ms query time.
- **Batch embedding**: Profile embeddings generated on-demand (not bulk). Posting embedding generated once on activation.
- **Shortlist size**: Default top-20 candidates. Configurable per deployment. Reduces agent conversations from O(N) to O(20).
- **Embedding cache**: `embeddingUpdatedAt` field avoids regenerating unchanged profiles.

---

## Testing Strategy

- **Unit tests**: `buildProfileText()`, `buildPostingText()` output validation; `generateEmbedding()` with mocked OpenAI API; similarity score computation
- **Integration tests**: Full pipeline from profile update through embedding generation to similarity search; fallback behavior
- **Mock strategy**: OpenAI embedding API mocked with deterministic vectors. pgvector queries tested against actual SQL (parameterized).
- **Coverage target**: 80%+ on all new code

---

## Risks & Mitigation

| Risk                                         | Likelihood | Impact | Mitigation                                                    |
| -------------------------------------------- | ---------- | ------ | ------------------------------------------------------------- |
| OpenAI embedding API changes                 | Low        | Medium | Pin model version; Zod validate response                      |
| pgvector index performance degrades at scale | Low        | High   | Monitor query latency; switch to HNSW index if needed         |
| Anthropic users feel excluded                | Medium     | Low    | Clear messaging; auto-enable when Anthropic offers embeddings |
| Stale embeddings produce bad matches         | Medium     | Medium | `embeddingUpdatedAt` tracking; configurable max age           |

---

## Constitutional Compliance

- [x] **I. Type Safety** — Zod schemas for embedding config and API responses; TypeScript throughout
- [x] **II. Test-Driven Development** — TDD mandatory; mocked OpenAI API; 80%+ coverage
- [x] **III. BYOK Architecture** — User's own OpenAI key for embeddings; no platform keys
- [x] **IV. Minimal Abstractions** — Direct OpenAI SDK call; no embedding framework
- [x] **V. Security & Privacy** — BYOK key handling follows existing pattern; embeddings deleted on cascade
- [x] **VI. Phased Rollout** — `VECTOR_SEARCH` feature flag for gradual enablement
- [x] **VII. Agent Autonomy** — Vector search is automatic; no human intervention in candidate selection
