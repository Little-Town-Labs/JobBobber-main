# Implementation Plan: Feature 27 — Hiring Metrics

## Executive Summary

Add a dedicated `/dashboard/metrics` sub-page to the employer dashboard displaying per-posting time-based hiring metrics, aggregate averages, trend analysis over 30/60/90 day windows with previous-period comparison, sortable posting performance table, and CSV export. One schema change: adds `mutualAcceptedAt DateTime?` to the Match model for reliable acceptance timestamps. Feature gated behind `HIRING_METRICS` flag.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│ /dashboard/metrics (page.tsx)                   │
│  ┌──────────┐ ┌────────────┐ ┌───────────────┐ │
│  │ Summary  │ │   Trend    │ │   CSV Export   │ │
│  │  Cards   │ │   Chart    │ │    Button      │ │
│  └──────────┘ └────────────┘ └───────────────┘ │
│  ┌──────────────────────────────────────────┐   │
│  │ Posting Performance Table (sortable)      │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
         │ useHiringMetricsGet({ windowDays })
         ▼
┌─────────────────────────────────────┐
│ hiringMetrics tRPC router           │
│  ├─ getHiringMetrics (query)        │
│  ├─ exportCsv (mutation)            │
│  └─ isEnabled (query)              │
└─────────────────────────────────────┘
         │ Promise.all([currentWindow, prevWindow])
         ▼
┌─────────────────────────────────────┐
│ Prisma: JobPosting + Match          │
│ (no schema changes)                 │
└─────────────────────────────────────┘
```

## Technology Decisions

### TD-1: Query Strategy — Prisma findMany + In-Memory Aggregation

**Decision:** Use `db.jobPosting.findMany` with selective match includes, compute metrics in TypeScript.

**Rationale:** For the 100-posting NFR target, in-memory aggregation is fast enough (<500ms) and maintains full Prisma type safety. Raw SQL with `MIN(createdAt)` would be faster at scale but sacrifices type safety for a P2 feature.

**Tradeoff:** May need raw SQL refactor if employers exceed 500+ postings. Monitor query times.

### TD-2: Trend Comparison — Two-Window Parallel Query

**Decision:** Fetch current window and previous equivalent window via `Promise.all`, compare averages.

**Rationale:** Simple, correct, and cheap. No precomputed trend data to maintain. Trend direction derived from 5% tolerance band (improving/stable/declining).

### TD-3: CSV Generation — Server-Side tRPC Mutation

**Decision:** Generate CSV as string in tRPC mutation, download client-side via Blob URL.

**Rationale:** Server-side ensures consistent auth/scoping. Mutation (not query) prevents React Query from caching stale exports — each click generates a fresh CSV. String return (not streaming) is fine for max 500 rows (~50KB). No external CSV library needed — simple string concatenation with RFC 4180 escaping.

### TD-4: Chart Visualization — Recharts

**Decision:** Install `recharts` for the trend comparison bar chart.

**Rationale:** Most widely used React charting library, good SSR compat, small bundle for our subset (BarChart). Dynamic import with `ssr: false` to avoid loading on main dashboard.

**Alternatives rejected:** tremor (heavier), visx (more boilerplate), nivo (larger bundle).

### TD-5: Separate Router (Not Extending Dashboard)

**Decision:** New `hiringMetrics` router, separate from existing `dashboardRouter`.

**Rationale:** Different feature flags (`HIRING_METRICS` vs `ADVANCED_EMPLOYER_DASHBOARD`). Follows project pattern of feature-scoped routers.

### TD-6: Window State in URL Params

**Decision:** Persist window selection in URL search params (`?window=60`).

**Rationale:** Page refresh preserves selection. URL is shareable/bookmarkable.

## Implementation Phases

### Phase 1: Infrastructure & Utilities

1.1 Add `HIRING_METRICS` feature flag to `src/lib/flags.ts`
1.2 Create `src/lib/metrics/format-duration.ts` — human-readable duration formatting
1.3 Create `src/lib/metrics/format-duration.test.ts` (TDD: write first)
1.4 Create `src/lib/metrics/csv-generator.ts` — RFC 4180 CSV from metrics data
1.5 Create `src/lib/metrics/csv-generator.test.ts` (TDD: write first)

### Phase 2: Backend (tRPC Router)

2.1 Write `src/server/api/routers/hiring-metrics.test.ts` (TDD: write first)
2.2 Create `src/server/api/routers/hiring-metrics.ts` with procedures:

- `getHiringMetrics` — input: `{ windowDays }`, output: postings + aggregates + trends
- `exportCsv` — input: `{ windowDays }`, output: `{ csv, filename }`
- `isEnabled` — returns boolean (for nav link visibility)
  2.3 Register router in `src/server/api/root.ts`
  2.4 Add typed hooks in `src/lib/trpc/hooks.ts`

### Phase 3: Frontend Components

3.1 Install recharts (`pnpm add recharts`)
3.2 Create `MetricsSummaryCards` — 5 KPI cards with trend arrows
3.3 Create `MetricsTrendChart` — grouped bar chart (current vs previous period)
3.4 Create `MetricsPostingTable` — sortable table with above/below avg highlighting
3.5 Create `MetricsCsvExport` — button triggering download via Blob URL
3.6 Write component tests

### Phase 4: Page Assembly + Navigation

4.1 Create `/dashboard/metrics/page.tsx` — assembles all components
4.2 Add "Metrics" nav link to dashboard (conditionally rendered via `isEnabled` query)

## Output Schema

```typescript
{
  postings: Array<{
    id: string
    title: string
    status: JobPostingStatus
    createdAt: Date
    firstMatchAt: Date | null
    firstMutualAcceptAt: Date | null
    timeToFirstMatchMs: number | null
    timeToMutualAcceptMs: number | null
    totalMatches: number
    totalAccepts: number
  }>
  aggregates: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
    totalPostings: number
    totalMatches: number
    totalAccepts: number
    postingsWithMatches: number
  }
  previousPeriod: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
    totalPostings: number
    totalMatches: number
  }
  trends: {
    timeToFirstMatch: "improving" | "stable" | "declining" | null
    timeToMutualAccept: "improving" | "stable" | "declining" | null
    matchVolume: "improving" | "stable" | "declining" | null
  }
  windowDays: number
}
```

## Testing Strategy

- **Unit:** format-duration edge cases, CSV generation/escaping
- **Integration:** Router logic with mocked Prisma — aggregation, window filtering, trend direction
- **Component:** KPI cards rendering, trend arrows, table sorting, empty states

## Security

- Metrics endpoint enforces employer auth + org scoping
- No seeker PII in metrics or CSV exports
- Feature flag gates all access

## Performance

- Target: <500ms for 100 postings (2 Prisma queries in parallel)
- CSV export: <2s for 500 postings
- Recharts loaded via dynamic import (no main dashboard bundle impact)

## Risks

| Risk                                             | Mitigation                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `Match.updatedAt` unreliable for acceptance time | Added `mutualAcceptedAt DateTime?` field to Match model; set explicitly on mutual acceptance |
| Large employer (100+ postings) slow queries      | Add `@@index([employerId, createdAt])` if needed                                             |
| Recharts bundle size                             | Dynamic import with `ssr: false`                                                             |

## Constitutional Compliance

- [x] Test-first imperative (TDD phases documented)
- [x] Simplicity enforced (no new models, in-memory aggregation)
- [x] Security standards met (auth, scoping, no PII)
- [x] Performance requirements addressed (<500ms target)
- [x] Feature flag gated
