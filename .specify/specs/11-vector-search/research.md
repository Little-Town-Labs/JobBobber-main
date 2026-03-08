# Technology Research — 11-vector-search

## Decision 1: Embedding Model

**Options Considered:**

1. **OpenAI text-embedding-3-small** — 1536 dimensions, $0.02/M tokens, good quality
2. **OpenAI text-embedding-3-large** — 3072 dimensions (or 1536 with `dimensions` param), $0.13/M tokens, best quality
3. **Anthropic Voyager** — Not yet available as a standalone embedding API

**Chosen:** OpenAI text-embedding-3-small (1536 dimensions)
**Rationale:** Schema already defines `vector(1536)` columns. The small model provides excellent quality-to-cost ratio. Users with Anthropic BYOK keys will need an OpenAI key for embeddings, OR we generate embeddings using a platform-provided key (violates BYOK). See Decision 4 for resolution.
**Tradeoffs:** Slightly lower quality than text-embedding-3-large; 1536 dimensions is sufficient for job matching.

## Decision 2: Vector Search Implementation

**Options Considered:**

1. **pgvector with raw SQL** — `db.$queryRaw` with cosine distance operator `<=>`, native to NeonDB
2. **Drizzle ORM with pgvector** — Type-safe vector queries via Drizzle's pgvector support
3. **External vector DB (Pinecone/Weaviate)** — Managed service, separate from primary DB

**Chosen:** pgvector with raw SQL (`db.$queryRaw`)
**Rationale:** Schema already declares pgvector extension and `Unsupported("vector(1536)")` fields. NeonDB supports pgvector natively. Raw SQL is required anyway since Prisma doesn't support vector types in its typed API. No additional infrastructure needed.
**Tradeoffs:** Raw SQL for vector queries (not type-safe), but isolated to a single module.

## Decision 3: Embedding Generation Trigger

**Options Considered:**

1. **Synchronous in API handler** — Generate embedding in the tRPC mutation
2. **Inngest background job** — Fire-and-forget after profile/posting update
3. **Prisma middleware** — Auto-trigger on model update

**Chosen:** Inngest background job
**Rationale:** Embedding generation takes 1-3 seconds. Blocking the API response degrades UX. Inngest provides retry logic, concurrency control, and observability — consistent with all other async operations in the codebase.
**Tradeoffs:** Brief window where profile exists without embedding (acceptable per FR-006 fallback).

## Decision 4: BYOK vs Platform Key for Embeddings

**Options Considered:**

1. **Use BYOK key** — Consistent with constitution, but Anthropic users can't generate embeddings
2. **Platform embedding key** — Single OpenAI key owned by platform, used only for embeddings
3. **Skip embedding for non-OpenAI users** — Fall back to non-vector matching

**Chosen:** Use BYOK key with fallback (Option 1 + 3)
**Rationale:** Constitutional principle III (BYOK) is NON-NEGOTIABLE. Users with OpenAI keys get vector search. Anthropic-only users fall back to the existing matching approach (FR-006). When Anthropic releases an embedding API, we can add support. This avoids any platform API cost.
**Tradeoffs:** Anthropic-only users don't benefit from vector search until Anthropic offers embeddings.

## Decision 5: Text Representation for Embeddings

**Options Considered:**

1. **Concatenate all fields** — Simple string joining of profile/posting fields
2. **Structured template** — Template that weights important fields (title, skills prominent)
3. **JSON serialization** — Raw JSON of the entity

**Chosen:** Structured template
**Rationale:** Embedding quality depends on input text quality. A template that emphasizes skills, title, and key requirements produces more relevant similarity scores than raw concatenation.
**Tradeoffs:** Template must be maintained when fields change.
