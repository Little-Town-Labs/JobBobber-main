# Technology Research — Feature 17: Advanced Employer Dashboard

## Decision 1: CSV Export Strategy

**Context:** Employers need to export matched candidate data as CSV files.

**Options Considered:**

1. **Client-side CSV generation** — Build CSV string in the browser from tRPC query data, trigger download via `Blob` URL.
   - Pros: No server changes, works offline, no additional server load
   - Cons: Limited to data already in browser memory, no streaming for large datasets

2. **Server-side CSV endpoint** — tRPC mutation returns a signed URL to a server-generated CSV file.
   - Pros: Can handle very large datasets, streaming possible
   - Cons: Additional server complexity, temporary file storage needed

3. **Server-generated CSV via tRPC response** — tRPC procedure returns CSV as a string, client triggers download.
   - Pros: Simpler than file storage, server controls format
   - Cons: Large responses could timeout, not truly streaming

**Chosen:** Option 1 — Client-side CSV generation
**Rationale:** The NFR-1 target is 1,000 matches max for CSV export. Client-side generation handles this well without server-side file management. The match data is already fetched via tRPC queries. A utility function converts match objects to CSV rows and triggers a browser download via `Blob` + `URL.createObjectURL`.
**Tradeoffs:** Cannot handle 10k+ exports, but this exceeds current requirements.

---

## Decision 2: Bulk Operations — Transaction Strategy

**Context:** Batch accept/decline must be atomic (NFR-4: all or none).

**Options Considered:**

1. **Prisma `$transaction`** — Wrap all updates in a single Prisma interactive transaction.
   - Pros: Native Prisma support, ACID guarantees, rollback on failure
   - Cons: Transaction timeout for very large batches

2. **Individual updates with rollback logic** — Update one by one, manually rollback on error.
   - Pros: No transaction timeout concerns
   - Cons: Complex rollback logic, race conditions possible

3. **Prisma `updateMany`** — Single SQL UPDATE with WHERE IN clause.
   - Pros: Single query, very fast, naturally atomic
   - Cons: No per-row validation, no mutual-accept side effects

**Chosen:** Option 3 — `updateMany` with pre-validation
**Rationale:** `updateMany` is a single SQL operation, inherently atomic. We pre-filter to only include matches with `employerStatus: PENDING` (skipping already-updated ones per EC-4). The response reports actual vs. requested update counts. For mutual accept checks, a follow-up query identifies newly-accepted matches where both sides accepted.
**Tradeoffs:** Mutual accept side effects require a second query, but this is acceptable for batch operations.

---

## Decision 3: Pipeline Aggregation — Query Strategy

**Context:** Pipeline overview needs match counts per posting without fetching all matches.

**Options Considered:**

1. **Prisma `groupBy`** — Group matches by jobPostingId and employerStatus, aggregate counts.
   - Pros: Single query, database-level aggregation, Prisma typed
   - Cons: Requires post-processing to reshape into per-posting structure

2. **Raw SQL with window functions** — Custom SQL for complex aggregation.
   - Pros: Maximum flexibility, potentially more efficient
   - Cons: Loses type safety, harder to maintain

3. **Multiple queries per posting** — Fetch counts for each posting individually.
   - Pros: Simple to implement
   - Cons: N+1 problem, unacceptable for 50+ postings

**Chosen:** Option 1 — Prisma `groupBy` with post-processing
**Rationale:** Aligns with Constitutional Principle I (Type Safety First). A single `groupBy` query on the Match table grouped by `[jobPostingId, employerStatus]` returns all counts in one round trip. A helper function reshapes the flat results into a per-posting summary object. For conversation metrics (FR-5), a parallel `groupBy` on AgentConversation provides total/in-progress/completed counts.
**Tradeoffs:** Two groupBy queries instead of one raw SQL, but maintains type safety.

---

## Decision 4: Comparison View — State Management

**Context:** Candidate comparison selection must persist during the session (US-2 AC-5).

**Options Considered:**

1. **React state (useState)** — Store selected match IDs in component state.
   - Pros: Simple, no external dependencies
   - Cons: Lost on navigation away from posting

2. **URL search params** — Encode selected IDs in the URL.
   - Pros: Shareable, survives page refreshes, persists across navigation
   - Cons: URL can get long with 4 IDs

3. **Session storage** — Store in browser sessionStorage.
   - Pros: Persists across navigation within the session
   - Cons: Not visible in URL, slightly more complex

**Chosen:** Option 2 — URL search params
**Rationale:** Search params (`?compare=id1,id2,id3`) make the comparison view bookmarkable and shareable between team members. Next.js `useSearchParams` integrates naturally. IDs are short (cuid format), so URL length is manageable.
**Tradeoffs:** URL is slightly less clean, but usability gains outweigh aesthetics.

---

## Decision 5: Advanced Filtering — Implementation Approach

**Context:** Multi-criteria filtering for matches (status, experience, location, confidence).

**Options Considered:**

1. **Server-side filtering** — Pass all filter params to tRPC, build WHERE clause dynamically.
   - Pros: Works for paginated data, efficient for large datasets
   - Cons: More tRPC procedure complexity

2. **Client-side filtering** — Fetch all matches, filter in browser.
   - Pros: Instant filter response, no API calls on filter change
   - Cons: Must fetch all data upfront, poor for large datasets

**Chosen:** Option 1 — Server-side filtering
**Rationale:** Postings can have 500+ matches (EC-8). Server-side filtering with cursor pagination keeps response sizes small. The existing `listForPosting` procedure already accepts `status` and `sort` params — we extend it with additional filter fields for experience level, location type, and confidence range.
**Tradeoffs:** Filter changes trigger new API calls, but debouncing mitigates perceived latency.
