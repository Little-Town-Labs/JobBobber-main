# Task Breakdown: Feature 27 — Hiring Metrics

**Plan:** .specify/specs/27-hiring-metrics/plan.md
**Total Tasks:** 19
**Total Effort:** ~14.5 hours
**Critical Path:** 0.1 → 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.2 → 3.3 → 4.1 → 5.1 → 5.2

---

## Phase 0: Schema Change

### Task 0.1: Add mutualAcceptedAt to Match Model

**Status:** 🟡 Ready
**Effort:** 0.5h
**Dependencies:** None

**Description:**
Add `mutualAcceptedAt DateTime?` column to Match model. Update status mutation paths to set it on mutual acceptance.

**Acceptance Criteria:**

- [ ] `mutualAcceptedAt DateTime?` added to Match model in `prisma/schema.prisma`
- [ ] `prisma migrate dev` succeeds
- [ ] Match status update paths in `matches.ts` router and `run-agent-conversation.ts` set `mutualAcceptedAt = new Date()` when both `seekerStatus` and `employerStatus` become `ACCEPTED`
- [ ] Existing match tests still pass

---

## Phase 1: Infrastructure & Utilities

### Task 1.1: Feature Flag + Utility Tests

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None
**Parallel with:** Task 0.1

**Description:**
Add `HIRING_METRICS` feature flag. Write tests for `formatDuration` and `csvGenerator` utilities. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `HIRING_METRICS` flag added to `src/lib/flags.ts`
- [ ] `src/lib/metrics/format-duration.test.ts` written — covers: 0ms, sub-hour, hours-only, days+hours, exactly 24h boundary, large values
- [ ] `src/lib/metrics/csv-generator.test.ts` written — covers: empty array, single posting, commas/quotes in title, null metric values
- [ ] All tests confirmed to FAIL (no implementation yet)

---

### Task 1.2: Utility Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 1h
**Dependencies:** Task 1.1

**Description:**
Implement `formatDuration(ms)` and `generateMetricsCsv(data)` to pass tests.

**Acceptance Criteria:**

- [ ] `src/lib/metrics/format-duration.ts` — returns "3 days 4 hours", "2 hours 15 minutes", "< 1 hour"
- [ ] `src/lib/metrics/csv-generator.ts` — RFC 4180 compliant CSV with proper escaping
- [ ] All tests from 1.1 pass

---

## Phase 2: Backend (tRPC Router)

### Task 2.1: Router Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 2h
**Dependencies:** Task 1.2

**Description:**
Write comprehensive tests for the `hiringMetrics` tRPC router. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `src/server/api/routers/hiring-metrics.test.ts` written with mocked Prisma
- [ ] Tests cover: empty state (no postings), time-to-first-match calculation, time-to-mutual-accept calculation, zero-match posting exclusion from averages, 30/60/90 day window filtering, previous-period comparison, trend direction computation (improving/stable/declining), CSV export columns and filename, NOT_FOUND when flag disabled, employer org scoping
- [ ] All tests confirmed to FAIL

---

### Task 2.2: Router Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2h
**Dependencies:** Task 2.1

**Description:**
Implement `hiringMetrics` tRPC router with `getHiringMetrics`, `exportCsv`, and `isEnabled` procedures.

**Acceptance Criteria:**

- [ ] `src/server/api/routers/hiring-metrics.ts` created
- [ ] `getHiringMetrics` — fetches two windows in parallel, computes per-posting metrics using `mutualAcceptedAt` for acceptance timestamps
- [ ] `exportCsv` — tRPC **mutation** (not query, to prevent stale cached exports); reuses computation logic, returns `{ csv, filename }`
- [ ] `isEnabled` — returns boolean from feature flag
- [ ] Shared `computeMetricsForWindow` internal function avoids duplication
- [ ] All tests from 2.1 pass

---

### Task 2.3: Router Registration + Hooks

**Status:** 🔴 Blocked by 2.2
**Effort:** 0.5h
**Dependencies:** Task 2.2

**Description:**
Register router and add typed tRPC hooks.

**Acceptance Criteria:**

- [ ] `hiringMetrics` router registered in `src/server/api/root.ts`
- [ ] `useHiringMetricsGet`, `useHiringMetricsExportCsv`, `useHiringMetricsIsEnabled` hooks added to `src/lib/trpc/hooks.ts`

---

## Phase 3: Frontend Components

### Task 3.1: Install Recharts

**Status:** 🟡 Ready
**Effort:** 0.25h
**Dependencies:** None
**Parallel with:** Phase 1, Phase 2

**Description:**
Install recharts dependency.

**Acceptance Criteria:**

- [ ] `pnpm add recharts` completed
- [ ] No type errors introduced

---

### Task 3.2: Component Tests

**Status:** 🔴 Blocked by 2.3
**Effort:** 1.5h
**Dependencies:** Task 2.3
**Parallel with:** Task 3.1

**Description:**
Write tests for all dashboard components. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `tests/unit/components/dashboard/metrics-summary-cards.test.tsx` — renders KPI values, trend arrows (green/red/gray), "Based on 1 posting" label, "No data" empty state
- [ ] `tests/unit/components/dashboard/metrics-posting-table.test.tsx` — sorting by each column, above/below avg highlighting, "No matches yet" / "Pending" text, empty state
- [ ] All tests confirmed to FAIL

---

### Task 3.3: MetricsSummaryCards Implementation

**Status:** 🔴 Blocked by 3.2
**Effort:** 1h
**Dependencies:** Task 3.2

**Description:**
Implement the 5 KPI summary cards with trend indicators.

**Acceptance Criteria:**

- [ ] `src/components/dashboard/metrics-summary-cards.tsx` created
- [ ] 5 cards: Avg Time to First Match, Avg Time to Mutual Accept, Total Postings, Total Matches, Total Accepts
- [ ] Green up-arrow for improving, red down-arrow for declining, gray dash for stable
- [ ] Uses `formatDuration` for time values
- [ ] Edge case: "Based on 1 posting" when `postingsWithMatches === 1`
- [ ] Relevant tests from 3.2 pass

---

### Task 3.4: MetricsTrendChart Implementation

**Status:** 🔴 Blocked by 3.1, 3.2
**Effort:** 1h
**Dependencies:** Tasks 3.1, 3.2

**Description:**
Implement grouped bar chart comparing current vs previous period.

**Acceptance Criteria:**

- [ ] `src/components/dashboard/metrics-trend-chart.tsx` created
- [ ] Uses recharts `BarChart` with grouped bars (current vs previous)
- [ ] Two metric groups: time-to-first-match, time-to-mutual-accept
- [ ] Loaded via `next/dynamic` with `ssr: false`
- [ ] Handles null values (no bar rendered)

---

### Task 3.5: MetricsPostingTable Implementation

**Status:** 🔴 Blocked by 3.2
**Effort:** 1h
**Dependencies:** Task 3.2

**Description:**
Implement sortable posting performance table.

**Acceptance Criteria:**

- [ ] `src/components/dashboard/metrics-posting-table.tsx` created
- [ ] Columns: Title, Status, Created, Time to First Match, Time to Mutual Accept, Matches, Accepts
- [ ] Client-side sorting via React state
- [ ] Green tint for both metrics below avg, red tint for both above avg
- [ ] "No matches yet" / "Pending" per spec edge cases
- [ ] Relevant tests from 3.2 pass

---

### Task 3.6: MetricsCsvExport Implementation

**Status:** 🔴 Blocked by 2.3
**Effort:** 0.5h
**Dependencies:** Task 2.3

**Description:**
Implement CSV export button component.

**Acceptance Criteria:**

- [ ] `src/components/dashboard/metrics-csv-export.tsx` created
- [ ] Triggers `exportCsv` tRPC query on click
- [ ] Creates Blob from CSV string, triggers download via temporary anchor
- [ ] Shows loading spinner while query executes

---

## Phase 4: Page Assembly + Navigation

### Task 4.1: Metrics Page

**Status:** 🔴 Blocked by 3.3, 3.4, 3.5, 3.6
**Effort:** 1h
**Dependencies:** Tasks 3.3, 3.4, 3.5, 3.6

**Description:**
Assemble the metrics page with all components.

**Acceptance Criteria:**

- [ ] `src/app/(employer)/dashboard/metrics/page.tsx` created
- [ ] Window selector toggle (30/60/90 days) using URL search params
- [ ] Layout: header + window selector + export → summary cards → trend chart → posting table
- [ ] Skeleton loading state
- [ ] Empty state: "Create your first job posting to start tracking hiring metrics."
- [ ] Data fetched via `useHiringMetricsGet({ windowDays })`

---

### Task 4.2: Dashboard Navigation Link

**Status:** 🔴 Blocked by 2.3
**Effort:** 0.5h
**Dependencies:** Task 2.3

**Description:**
Add "Metrics" nav link to employer dashboard, conditionally rendered.

**Acceptance Criteria:**

- [ ] "Metrics" link added to dashboard navigation
- [ ] Conditionally rendered based on `useHiringMetricsIsEnabled()` query
- [ ] Links to `/dashboard/metrics`

---

## Phase 5: Quality Gates

### Task 5.1: Code Review

**Status:** 🔴 Blocked by 4.1, 4.2
**Effort:** 0.5h
**Dependencies:** Tasks 4.1, 4.2

**Description:**
Run `/code-review` on all new and modified files.

**Acceptance Criteria:**

- [ ] All CRITICAL and HIGH issues resolved
- [ ] No hardcoded values or console.log statements
- [ ] TypeScript compilation passes with zero errors

---

### Task 5.2: Full Test Suite Validation

**Status:** 🔴 Blocked by 5.1
**Effort:** 0.25h
**Dependencies:** Task 5.1

**Description:**
Run full test suite to verify no regressions.

**Acceptance Criteria:**

- [ ] All existing tests still pass
- [ ] New test coverage >= 80% for feature code
- [ ] Zero TypeScript errors

---

## Dependency Graph

```
1.1 (flag + tests) → 1.2 (utilities)
                          ↓
                     2.1 (router tests) → 2.2 (router impl) → 2.3 (registration)
                                                                    ↓
3.1 (recharts) ──────────────────────────────┐                 3.2 (component tests)
                                             ↓                      ↓
                                         3.4 (chart)    3.3 (cards)  3.5 (table)  3.6 (export)
                                             ↓                ↓           ↓            ↓
                                         4.1 (page) ←────────┴───────────┴────────────┘
                                             ↓
                                    4.2 (nav link)
                                             ↓
                                    5.1 (review) → 5.2 (validation)
```

**Critical Path:** 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 3.2 → 3.3 → 4.1 → 5.1 → 5.2
**Parallel opportunities:** 3.1 runs independently; 3.3/3.4/3.5/3.6 run in parallel after 3.2
