# Data Model: Feature 27 — Hiring Metrics

## Schema Change: Match Model

Add a dedicated timestamp for mutual acceptance to avoid relying on `@updatedAt` (which changes on any field update, not just status transitions).

### Modified Model: Match

| Field            | Type      | Constraints | Description                                                   |
| ---------------- | --------- | ----------- | ------------------------------------------------------------- |
| mutualAcceptedAt | DateTime? | Optional    | Set when both seekerStatus and employerStatus become ACCEPTED |

**Migration:** Add nullable `mutualAcceptedAt` column to `matches` table. No backfill needed — historical matches without this field return `null` for time-to-mutual-accept metrics.

**Set via:** Update the match status mutation paths (in `matches.ts` router and `run-agent-conversation.ts`) to check if both statuses are now ACCEPTED after any status change, and set `mutualAcceptedAt = new Date()` if so.

## Query Patterns

### Query 1: Postings with Match Data (per window)

```
db.jobPosting.findMany({
  where: {
    employerId,
    createdAt: { gte: windowStart, lt: windowEnd }
  },
  select: {
    id, title, status, createdAt,
    matches: {
      select: { id, createdAt, updatedAt, seekerStatus, employerStatus },
      orderBy: { createdAt: 'asc' }
    }
  }
})
```

**Index coverage:** Existing `@@index([status, employerId])` on `job_postings`. A composite `(employerId, createdAt)` index would be ideal but not critical for 100-posting target.

### Query 2: Time-to-First-Match (in-memory)

For each posting: `matches[0].createdAt - posting.createdAt`. Null if no matches.

### Query 3: Time-to-Mutual-Accept (in-memory)

First match where `mutualAcceptedAt IS NOT NULL`, ordered by `mutualAcceptedAt ASC`. Compute `match.mutualAcceptedAt - posting.createdAt`. Null if none exists.

### Query 4: Aggregates (in-memory)

```typescript
const withMatches = postings.filter((p) => p.timeToFirstMatchMs !== null)
const avgFirstMatch =
  withMatches.length > 0
    ? withMatches.reduce((sum, p) => sum + p.timeToFirstMatchMs!, 0) / withMatches.length
    : null
```

### Query 5: Previous Period

Same as Query 1 with shifted dates:

- `windowStart = now - (2 * windowDays)`
- `windowEnd = now - windowDays`

Both windows fetched in parallel via `Promise.all`.

## Performance

| Metric           | Target        | Approach                                                   |
| ---------------- | ------------- | ---------------------------------------------------------- |
| 100 postings     | < 500ms       | Single findMany with match includes, in-memory aggregation |
| 500 postings CSV | < 2s          | Same pattern, string concatenation                         |
| DB round trips   | 2 per request | Current + previous window in parallel                      |

## Potential Index (if needed)

```prisma
@@index([employerId, createdAt])  // on JobPosting
```

Not added now — existing indexes sufficient for expected data volumes.
