# Tasks — Feature 17: Advanced Employer Dashboard

**Branch:** `17-advanced-employer-dashboard`
**Plan:** `.specify/specs/17-advanced-employer-dashboard/plan.md`
**Feature Flag:** `ADVANCED_EMPLOYER_DASHBOARD` (defaults OFF)

---

## Summary

- **Total Tasks:** 26
- **Phases:** 7
- **Critical Path:** 1.1 → 1.2 → 2.1 → 2.2 → 3.1 → 3.2 → 4.1 → 4.2 → 7.1

---

## Phase 1: Foundation (Feature Flag + Dashboard Router)

### Task 1.1: Feature Flag + Dashboard Router — Tests

**Status:** 🟡 Ready
**Effort:** 1.5 hours
**Dependencies:** None
**User Stories:** All (FR-8 gating)

**Description:**
Write tests for the `ADVANCED_EMPLOYER_DASHBOARD` feature flag and the new `dashboard` tRPC router. **TESTS FIRST** (TDD).

**Test Coverage:**

- Feature flag exists and defaults to OFF
- `dashboard.getPipelineSummary`:
  - Returns aggregated match counts grouped by posting
  - Returns conversation metrics (total, in-progress, completed) per posting
  - Calculates match rate percentage per posting
  - Returns only postings owned by the authenticated employer
  - Returns totals across all postings
  - Throws NOT_FOUND when flag is OFF
- `dashboard.getPostingMetrics`:
  - Returns conversation and match metrics for a single posting
  - Verifies employer owns the posting
  - Throws NOT_FOUND for non-owned posting

**Acceptance Criteria:**

- [ ] Unit tests for getPipelineSummary with mocked Prisma groupBy
- [ ] Unit tests for getPostingMetrics with mocked Prisma
- [ ] Feature flag assertion tested
- [ ] Tests confirmed to FAIL (no implementation yet)

---

### Task 1.2: Feature Flag + Dashboard Router — Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 2 hours
**Dependencies:** Task 1.1

**Description:**
Add `ADVANCED_EMPLOYER_DASHBOARD` flag to `src/lib/flags.ts`. Create `src/server/api/routers/dashboard.ts` with `getPipelineSummary` and `getPostingMetrics` procedures. Register in `src/server/api/root.ts`.

**Acceptance Criteria:**

- [ ] Feature flag added, defaults OFF
- [ ] `getPipelineSummary` uses Match.groupBy + AgentConversation.groupBy
- [ ] `getPostingMetrics` returns per-posting metrics
- [ ] Both procedures use `assertFlagEnabled(ADVANCED_EMPLOYER_DASHBOARD)`
- [ ] Both procedures use `employerProcedure`
- [ ] Router registered in root.ts
- [ ] All tests from 1.1 pass

---

## Phase 2: Enhanced Matches Router

### Task 2.1: Extended Filtering + Comparison + Bulk — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 2.5 hours
**Dependencies:** Task 1.2
**User Stories:** US-2 (Comparison), US-3 (Bulk), US-5 (Filtering)
**Parallel with:** None (extends existing matches router)

**Description:**
Write tests for the enhanced matches router procedures. **TESTS FIRST** (TDD).

**Test Coverage:**

- `matches.listForPosting` extended filters:
  - Filter by `experienceLevel[]` (joins through conversation → seeker)
  - Filter by `locationType[]` (posting field)
  - Filter by `confidenceLevel[]` (STRONG/GOOD/POTENTIAL)
  - Multiple filters combined (AND logic)
  - Existing status/sort filters still work
- `matches.getForComparison`:
  - Returns 2-4 matches with joined seeker data (name, skills, experience, location)
  - Validates min 2 / max 4 match IDs
  - Verifies employer owns the posting
  - Throws on non-owned posting or invalid match IDs
- `matches.bulkUpdateStatus`:
  - Updates multiple matches atomically
  - Only updates PENDING matches (skips non-PENDING per EC-4)
  - Returns {updated, skipped, total} counts
  - Verifies employer owns the posting
  - Logs activity via logActivity()
  - Throws on non-owned posting

**Acceptance Criteria:**

- [ ] Filter tests cover all 3 new filter dimensions
- [ ] Comparison tests verify min/max selection validation
- [ ] Bulk tests verify atomic update and skip logic
- [ ] Activity logging tested
- [ ] Tests confirmed to FAIL

---

### Task 2.2: Extended Filtering + Comparison + Bulk — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 3 hours
**Dependencies:** Task 2.1

**Description:**
Extend `matches.listForPosting` with new filter params. Add `matches.getForComparison` and `matches.bulkUpdateStatus` procedures.

**Acceptance Criteria:**

- [ ] `listForPosting` accepts experienceLevel[], locationType[], confidenceLevel[]
- [ ] `getForComparison` returns matches with joined seeker data
- [ ] `bulkUpdateStatus` uses updateMany with PENDING pre-filter
- [ ] Activity logging fires on bulk operations
- [ ] All procedures gated behind feature flag
- [ ] All tests from 2.1 pass

---

## Phase 3: Pipeline UI

### Task 3.1: Pipeline View + Metrics Card — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 2 hours
**Dependencies:** Task 1.2
**User Stories:** US-1 (Pipeline), US-4 (Metrics)
**Parallel with:** Task 2.1

**Description:**
Write component tests for PipelineView and PostingMetricsCard. **TESTS FIRST** (TDD).

**Test Coverage:**

- `PipelineView`:
  - Shows loading skeleton while data loads
  - Renders posting rows with title, status, match counts
  - Shows match rate percentage per posting
  - Shows totals row with aggregate counts
  - Shows empty state when no active postings (EC-1)
  - Postings sortable by title, match count, match rate
  - Click navigates to posting matches page
- `PostingMetricsCard`:
  - Renders conversation metrics (total, in-progress, completed)
  - Shows match rate
  - Shows zero state for new postings (EC-2)

**Acceptance Criteria:**

- [ ] Component tests use vi.hoisted() mock pattern for tRPC
- [ ] Loading, data, and empty states tested
- [ ] Sort interaction tested
- [ ] Tests confirmed to FAIL

---

### Task 3.2: Pipeline View + Metrics Card — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 2 hours
**Dependencies:** Task 3.1

**Description:**
Create `src/components/dashboard/pipeline-view.tsx` and `src/components/dashboard/posting-metrics-card.tsx`. Integrate into `/dashboard` page conditionally when flag is enabled.

**Acceptance Criteria:**

- [ ] PipelineView renders posting summary grid with Tailwind
- [ ] PostingMetricsCard shows conversation and match stats
- [ ] Integrated into existing employer dashboard page
- [ ] Conditionally rendered when ADVANCED_EMPLOYER_DASHBOARD flag enabled
- [ ] All tests from 3.1 pass

---

## Phase 4: Comparison & Bulk Operations UI

### Task 4.1: Candidate Comparison — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1.5 hours
**Dependencies:** Task 2.2
**User Stories:** US-2 (Comparison)

**Description:**
Write component tests for CandidateComparison. **TESTS FIRST** (TDD).

**Test Coverage:**

- Renders side-by-side view for 2-4 candidates
- Shows confidence score, match summary, skills, experience, location
- Highlights differences (e.g., confidence ranking)
- Accept/decline buttons on each candidate
- Shows prompt when <2 candidates selected
- Prevents selection of >4 candidates (EC-3)
- Uses URL search params for state

**Acceptance Criteria:**

- [ ] Rendering tests for 2, 3, and 4 candidates
- [ ] Action button tests (accept/decline)
- [ ] Validation edge case tests
- [ ] Tests confirmed to FAIL

---

### Task 4.2: Candidate Comparison — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 2 hours
**Dependencies:** Task 4.1

**Description:**
Create `src/components/matches/candidate-comparison.tsx`. Uses URL search params (`?compare=id1,id2,id3`) for state. Calls `matches.getForComparison` tRPC query.

**Acceptance Criteria:**

- [ ] Side-by-side layout with Tailwind grid
- [ ] Reads/writes comparison IDs from URL search params
- [ ] Accept/decline calls updateStatus mutation
- [ ] All tests from 4.1 pass

---

### Task 4.3: Bulk Action Bar — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1.5 hours
**Dependencies:** Task 2.2
**User Stories:** US-3 (Bulk Operations)
**Parallel with:** Task 4.1

**Description:**
Write component tests for BulkActionBar. **TESTS FIRST** (TDD).

**Test Coverage:**

- Checkboxes appear on each match row
- "Select All" checkbox selects/deselects all visible
- Batch accept button calls bulkUpdateStatus with selected IDs
- Batch decline button calls bulkUpdateStatus with selected IDs
- Confirmation dialog shown before batch operations
- Shows updated/skipped counts after operation
- Disabled state when no matches selected

**Acceptance Criteria:**

- [ ] Selection interaction tests
- [ ] Batch action tests with mock mutation
- [ ] Confirmation dialog tests
- [ ] Tests confirmed to FAIL

---

### Task 4.4: Bulk Action Bar — Implementation

**Status:** 🔴 Blocked by 4.3
**Effort:** 1.5 hours
**Dependencies:** Task 4.3

**Description:**
Create `src/components/matches/bulk-action-bar.tsx`. Manages selected match IDs in local state. Calls `matches.bulkUpdateStatus` mutation.

**Acceptance Criteria:**

- [ ] Checkbox selection with "Select All"
- [ ] Confirmation dialog before batch operations
- [ ] Shows result summary (updated/skipped)
- [ ] Invalidates match list query after operation
- [ ] All tests from 4.3 pass

---

### Task 4.5: CSV Export — Tests

**Status:** 🟡 Ready
**Effort:** 1 hour
**Dependencies:** None (pure utility)
**User Stories:** US-3 (CSV Export)
**Parallel with:** Tasks 4.1, 4.3

**Description:**
Write tests for the CSV export utility. **TESTS FIRST** (TDD).

**Test Coverage:**

- Converts array of match objects to CSV string with headers
- Handles special characters (commas, quotes, newlines) in field values
- Includes fields: name, confidence score, status, posting title, match date
- Does NOT include private parameters or salary data (NFR-2)
- Returns empty string for empty input
- Triggers download via Blob API (mock)

**Acceptance Criteria:**

- [ ] CSV format tests (headers, rows, escaping)
- [ ] Privacy exclusion tests
- [ ] Empty/edge case tests
- [ ] Tests confirmed to FAIL

---

### Task 4.6: CSV Export — Implementation

**Status:** 🔴 Blocked by 4.5
**Effort:** 0.5 hours
**Dependencies:** Task 4.5

**Description:**
Create `src/lib/csv-export.ts` with `generateMatchCsv()` and `downloadCsv()` utilities.

**Acceptance Criteria:**

- [ ] Generates proper CSV with escaping
- [ ] Download triggers via Blob + URL.createObjectURL
- [ ] No private data included
- [ ] All tests from 4.5 pass

---

### Task 4.7: CSV Export Button — Integration

**Status:** 🔴 Blocked by 4.4, 4.6
**Effort:** 0.5 hours
**Dependencies:** Tasks 4.4, 4.6

**Description:**
Add CSV export button to BulkActionBar. Exports selected matches (or all if none selected). Disabled when no data available (EC-5).

**Acceptance Criteria:**

- [ ] Button integrated into BulkActionBar
- [ ] Exports selected or all matches
- [ ] Disabled when no matches (with tooltip)

---

## Phase 5: Advanced Filtering UI

### Task 5.1: Advanced Filters — Tests

**Status:** 🔴 Blocked by 2.2
**Effort:** 1.5 hours
**Dependencies:** Task 2.2
**User Stories:** US-5 (Advanced Filtering)
**Parallel with:** Tasks 4.1, 4.3

**Description:**
Write component tests for AdvancedFilters. **TESTS FIRST** (TDD).

**Test Coverage:**

- Renders filter dropdowns: status, experience level, location type, confidence
- Multiple filters combinable
- Active filter count displayed
- "Clear filters" resets all
- Filter changes trigger query refetch (not full page reload)
- Filter state reflected in component UI

**Acceptance Criteria:**

- [ ] Filter rendering tests for all 4 dimensions
- [ ] Combination and clear tests
- [ ] Active count display tests
- [ ] Tests confirmed to FAIL

---

### Task 5.2: Advanced Filters — Implementation

**Status:** 🔴 Blocked by 5.1
**Effort:** 1.5 hours
**Dependencies:** Task 5.1

**Description:**
Create `src/components/matches/advanced-filters.tsx`. Integrates into `/postings/[id]/matches` page, passing filter values to the tRPC query.

**Acceptance Criteria:**

- [ ] Filter panel with multi-select for each dimension
- [ ] Active filter count badge
- [ ] Clear all button
- [ ] Wired to listForPosting query params
- [ ] All tests from 5.1 pass

---

## Phase 6: Team Activity Enhancement

### Task 6.1: Enhanced Activity Log — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2
**User Stories:** US-6 (Team Activity)
**Parallel with:** Tasks 2.1, 3.1

**Description:**
Write tests for enhanced team activity log filters. Cursor pagination already exists in `team.getActivityLog` — only member and action filters are new. **TESTS FIRST** (TDD).

**Test Coverage:**

- Existing cursor pagination still works
- NEW: Filter by team member (actorClerkUserId)
- NEW: Filter by action type
- Only visible to Admin role members
- Renders team member name, action, target, timestamp
- Shows both ADVANCED_EMPLOYER_DASHBOARD and MULTI_MEMBER_EMPLOYER flags required

**Acceptance Criteria:**

- [ ] Pagination tests
- [ ] Filter tests
- [ ] Admin role enforcement tests
- [ ] Dual flag requirement tested
- [ ] Tests confirmed to FAIL

---

### Task 6.2: Enhanced Activity Log — Implementation

**Status:** 🔴 Blocked by 6.1
**Effort:** 1.5 hours
**Dependencies:** Task 6.1

**Description:**
Extend existing team activity log in `src/server/api/routers/team.ts` with member filter and action filter (cursor pagination already exists). Update `/dashboard/team` page to render enhanced log when both flags enabled. Single-member employers do not see the section (EC-6).

**Acceptance Criteria:**

- [ ] Cursor-based pagination added
- [ ] Filter by member and action type
- [ ] Admin role check enforced
- [ ] Both feature flags checked
- [ ] EC-6: hidden for single-member employers
- [ ] All tests from 6.1 pass

---

## Phase 7: Integration & Quality

### Task 7.1: Matches Page Integration

**Status:** 🔴 Blocked by 4.2, 4.4, 4.7, 5.2
**Effort:** 1.5 hours
**Dependencies:** Tasks 4.2, 4.4, 4.7, 5.2

**Description:**
Integrate all new components into `/postings/[id]/matches` page: AdvancedFilters, BulkActionBar (with CSV export), and CandidateComparison. Conditionally rendered when `ADVANCED_EMPLOYER_DASHBOARD` flag is enabled. Existing page unchanged when flag is OFF.

**Acceptance Criteria:**

- [ ] All components wired together on matches page
- [ ] Feature flag gating: advanced features hidden when OFF
- [ ] Existing page behavior preserved when flag OFF
- [ ] Compare mode triggered via URL params

---

### Task 7.2: Dashboard Page Integration

**Status:** 🔴 Blocked by 3.2, 6.2
**Effort:** 1 hour
**Dependencies:** Tasks 3.2, 6.2

**Description:**
Integrate PipelineView into `/dashboard` page. Show enhanced team activity on `/dashboard/team`. Both conditionally rendered when flag is enabled.

**Acceptance Criteria:**

- [ ] Pipeline view appears on dashboard when flag enabled
- [ ] Team activity enhanced when both flags enabled
- [ ] Existing dashboard unchanged when flag OFF

---

### Task 7.3: Security Review

**Status:** 🔴 Blocked by 7.1, 7.2
**Effort:** 1 hour
**Dependencies:** Tasks 7.1, 7.2

**Description:**
Review all new procedures and components for security issues.

**Acceptance Criteria:**

- [ ] All procedures enforce employer ownership
- [ ] Comparison view does not expose private data
- [ ] CSV export excludes salary and private params
- [ ] Bulk operations validate posting ownership
- [ ] Team activity restricted to Admin role
- [ ] No OWASP Top 10 violations

---

### Task 7.4: Full Test Suite Verification

**Status:** 🔴 Blocked by 7.3
**Effort:** 0.5 hours
**Dependencies:** Task 7.3

**Description:**
Run the complete test suite to verify no regressions. Verify 80%+ coverage on new code.

**Acceptance Criteria:**

- [ ] Full test suite passes (no regressions)
- [ ] New code has 80%+ coverage
- [ ] Feature flag OFF = existing behavior unchanged

---

## Dependency Graph

```
Phase 1:              1.1 → 1.2
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
Phase 2: 2.1 → 2.2   Phase 3:     Phase 6:
          │           3.1 → 3.2    6.1 → 6.2
          │             │             │
    ┌─────┼─────┐       │             │
    ▼     ▼     ▼       │             │
Phase 4:              Phase 5:        │
  4.1→4.2  4.3→4.4    5.1→5.2        │
  4.5→4.6              │             │
       │               │             │
       ▼               │             │
      4.7              │             │
       │               │             │
       ▼               ▼             │
Phase 7:   7.1 ◄──────────          │
           7.2 ◄─────────────────────┘
            │
            ▼
           7.3 → 7.4
```

## Critical Path

```
1.1 → 1.2 → 2.1 → 2.2 → 4.1 → 4.2 → 7.1 → 7.3 → 7.4
```

**Duration:** ~16 hours on critical path

## Parallelization Opportunities

| Parallel Group | Tasks              | Reason                                                 |
| -------------- | ------------------ | ------------------------------------------------------ |
| A              | 2.1, 3.1, 6.1      | Independent: matches router, pipeline UI, activity log |
| B              | 4.1, 4.3, 4.5, 5.1 | Independent components: comparison, bulk, CSV, filters |
| C              | 3.2, 6.2           | Independent: pipeline impl, activity impl              |
| D              | 7.1, 7.2           | Independent: matches page, dashboard page              |

## User Story → Task Mapping

| User Story                 | Tasks                                  |
| -------------------------- | -------------------------------------- |
| US-1: Pipeline Overview    | 1.1, 1.2, 3.1, 3.2, 7.2                |
| US-2: Candidate Comparison | 2.1, 2.2, 4.1, 4.2, 7.1                |
| US-3: Bulk Operations      | 2.1, 2.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.1 |
| US-4: Posting Metrics      | 1.1, 1.2, 3.1, 3.2                     |
| US-5: Advanced Filtering   | 2.1, 2.2, 5.1, 5.2, 7.1                |
| US-6: Team Activity        | 6.1, 6.2, 7.2                          |
| FR-8: Feature Flag         | 1.1, 1.2, all gating                   |

## Quality Gates

- [ ] **Phase 1 Gate:** Dashboard router tests pass, flag works
- [ ] **Phase 2 Gate:** All matches router extensions tested and passing
- [ ] **Phase 4 Gate:** All UI components render correctly with mock data
- [ ] **Phase 7 Gate:** Security review passed, full suite green, 80%+ coverage
