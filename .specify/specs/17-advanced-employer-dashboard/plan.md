# Implementation Plan — Feature 17: Advanced Employer Dashboard

**Branch:** `17-advanced-employer-dashboard`
**Specification:** `.specify/specs/17-advanced-employer-dashboard/spec.md`
**Feature Flag:** `ADVANCED_EMPLOYER_DASHBOARD` (defaults OFF)

---

## Executive Summary

Feature 17 enhances the employer dashboard with pipeline visibility, candidate comparison, bulk operations, posting metrics, advanced filtering, and team activity viewing. This is a **UI-heavy feature** built entirely on existing data models — no new database tables or migrations required. The implementation adds one new tRPC router (`dashboard`), extends the existing `matches` router with new procedures, and creates 6 new React components.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Pages (Next.js)                    │
│  /dashboard           → PipelineView                │
│  /postings/[id]/matches → Enhanced MatchList         │
│  /postings/[id]/matches?compare=a,b,c → CompareView │
│  /dashboard/team      → Enhanced ActivityLog         │
└───────────────┬─────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│              Components (React)                      │
│  PipelineView         → Pipeline summary grid        │
│  PostingMetricsCard   → Per-posting metrics          │
│  CandidateComparison  → Side-by-side 2-4 candidates │
│  BulkActionBar        → Checkbox + batch controls    │
│  AdvancedFilters      → Multi-criteria filter panel  │
│  CsvExportButton      → Client-side CSV download     │
└───────────────┬─────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│              tRPC API Layer                           │
│  dashboard.getPipelineSummary  (NEW)                 │
│  dashboard.getPostingMetrics   (NEW)                 │
│  matches.listForPosting        (EXTENDED: filters)   │
│  matches.getForComparison      (NEW)                 │
│  matches.bulkUpdateStatus      (NEW)                 │
│  team.getActivityLog           (EXTENDED: pagination)│
└───────────────┬─────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│              Prisma Queries                           │
│  Match.groupBy        → Pipeline aggregation         │
│  Conversation.groupBy → Conversation metrics         │
│  Match.findMany       → Filtered match list          │
│  Match.updateMany     → Bulk status changes          │
│  Match + JobSeeker    → Comparison data              │
│  ActivityLog.findMany → Team activity (existing)     │
└─────────────────────────────────────────────────────┘
```

---

## Technology Stack

All decisions align with the locked stack (Constitution §Technical Constraints):

| Layer         | Technology              | Rationale                                                                     |
| ------------- | ----------------------- | ----------------------------------------------------------------------------- |
| Frontend      | React 19 + Tailwind CSS | Existing stack, vanilla HTML + Tailwind (no shadcn/ui per project convention) |
| API           | tRPC 11                 | Type-safe end-to-end, existing router pattern                                 |
| Database      | Prisma 5 + NeonDB       | Existing ORM, groupBy for aggregation                                         |
| CSV Export    | Client-side Blob API    | Handles <1000 rows per NFR-1, no server storage needed                        |
| State         | URL search params       | Comparison selection persists in URL (shareable)                              |
| Feature Flags | Vercel Flags SDK        | Existing pattern, assertFlagEnabled() helper                                  |

---

## Technical Decisions

### TD-1: No New Database Models

**Context:** Feature 17 adds views and actions on existing data.
**Decision:** No schema changes. All work is queries, procedures, and UI.
**Rationale:** JobPosting, Match, AgentConversation, ActivityLog already contain all needed data. Adding denormalized summary tables would violate Principle IV (Minimal Abstractions).
**Tradeoff:** Aggregation computed on read, not pre-computed. Acceptable for <50 postings per employer.

### TD-2: New Dashboard Router

**Context:** Pipeline and metrics queries don't fit cleanly in the existing matches or jobPostings routers.
**Decision:** Create a new `dashboard` tRPC router for aggregation-focused employer queries.
**Rationale:** Separation of concerns — the dashboard router aggregates across postings, while matches router handles individual posting match operations.
**Tradeoff:** One more router to maintain, but keeps each router focused.

### TD-3: Client-Side CSV Export

**Context:** CSV export for up to 1,000 matches.
**Decision:** Generate CSV in the browser from existing tRPC query data.
**Rationale:** Simplest approach, no server-side file management, works within NFR-1 (3 seconds for 1,000 rows). See research.md Decision 1.

### TD-4: Prisma updateMany for Bulk Operations

**Context:** Batch accept/decline must be atomic (NFR-4).
**Decision:** Single `updateMany` call with pre-validation.
**Rationale:** Inherently atomic, single SQL UPDATE. Pre-filter to PENDING-only matches to handle EC-4 (already-updated). See research.md Decision 2.

### TD-5: URL Search Params for Comparison State

**Context:** Comparison selection must persist during session navigation.
**Decision:** Encode selected match IDs in URL search params (`?compare=id1,id2,id3`).
**Rationale:** Shareable between team members, survives navigation, integrates with Next.js. See research.md Decision 4.

---

## Implementation Phases

### Phase 1: Foundation (Feature Flag + Dashboard Router)

1. Add `ADVANCED_EMPLOYER_DASHBOARD` feature flag to `src/lib/flags.ts`
2. Create `src/server/api/routers/dashboard.ts` with:
   - `getPipelineSummary` — aggregates match/conversation counts across all employer postings
   - `getPostingMetrics` — per-posting conversation and match metrics
3. Register dashboard router in `src/server/api/root.ts`
4. Tests for both procedures with mocked Prisma

### Phase 2: Enhanced Matches Router

1. Extend `matches.listForPosting` input schema with new filter fields:
   - `experienceLevel[]`, `locationType[]`, `confidenceLevel[]`
2. Add `matches.getForComparison` — fetches 2-4 matches with joined seeker data
3. Add `matches.bulkUpdateStatus` — atomic batch status update
4. Add activity logging to bulk operations via existing `logActivity()`
5. Tests for all new/modified procedures

### Phase 3: Pipeline UI

1. Create `src/components/dashboard/pipeline-view.tsx` — summary grid of all postings
2. Create `src/components/dashboard/posting-metrics-card.tsx` — per-posting metrics display
3. Integrate into existing `/dashboard` page (conditionally rendered when flag enabled)
4. Tests for pipeline components

### Phase 4: Comparison & Bulk Operations UI

1. Create `src/components/matches/candidate-comparison.tsx` — side-by-side 2-4 candidates
2. Create `src/components/matches/bulk-action-bar.tsx` — checkbox selection + batch controls
3. Create `src/lib/csv-export.ts` — utility to convert match data to CSV and trigger download
4. Integrate into `/postings/[id]/matches` page
5. Tests for comparison and bulk components + CSV utility

### Phase 5: Advanced Filtering UI

1. Create `src/components/matches/advanced-filters.tsx` — multi-criteria filter panel
2. Integrate filters into the matches page, wired to tRPC query params
3. Tests for filter component

### Phase 6: Team Activity Enhancement

1. Extend existing team activity log with pagination, filtering by member/action
2. Integrate into `/dashboard/team` page (visible to admins only when both flags enabled)
3. Tests for enhanced activity log

### Phase 7: Quality & Polish

1. Security review — verify all new procedures enforce employer ownership
2. Code review of all changed files
3. Verify no regressions in existing test suite
4. Verify feature flag gating works (flag OFF = existing dashboard unchanged)

---

## Security Considerations

### Data Access Control

- All new procedures use `employerProcedure` — requires authenticated employer session
- Pipeline summary only returns postings owned by the authenticated employer (`where: { employerId: ctx.employer.id }`)
- Bulk operations verify posting ownership before updating matches
- Comparison view joins JobSeeker data but only exposes: name, skills, experience level, location (no private params, no salary data)
- CSV export does not include private negotiation parameters (SeekerSettings, JobSettings)

### Team Activity Access

- Activity log procedures require Admin role check via EmployerMember table
- Both `ADVANCED_EMPLOYER_DASHBOARD` and `MULTI_MEMBER_EMPLOYER` flags must be enabled

### Input Validation

- All inputs validated with Zod schemas (Constitution §I)
- `matchIds` array limited to max 100 for bulk operations, max 4 for comparison
- Filter enums validated against Prisma enum types

---

## Performance Strategy

### Pipeline Summary (NFR-1: <1 second for 50 postings)

- Two `groupBy` queries (Match + AgentConversation) — single round trip each
- Post-processing in JS to reshape into per-posting summary
- No N+1: avoids fetching individual matches for count

### Comparison View (NFR-1: <500ms for 4 candidates)

- Single query: `Match.findMany({ where: { id: { in: ids } }, include: { seeker: { select: ... } } })`
- Minimal seeker fields selected (no full profile)

### Bulk Operations (NFR-1: <2 seconds for 100 matches)

- Single `updateMany` SQL operation — O(1) database round trip
- Pre-validation in application layer

### CSV Export (NFR-1: <3 seconds for 1,000 rows)

- Client-side generation from already-fetched data
- No additional API calls — uses current query results

---

## Testing Strategy

### Unit Tests

- Dashboard router procedures (getPipelineSummary, getPostingMetrics)
- Matches router new procedures (getForComparison, bulkUpdateStatus)
- Enhanced filtering logic
- CSV export utility
- All component rendering and interaction

### Integration Tests

- Bulk operations with pre-existing non-PENDING matches (EC-4)
- Pipeline summary with mixed posting statuses
- Comparison with missing seeker data

### TDD Workflow

Strict RED-GREEN-REFACTOR per Constitution §II:

1. Write tests first for each procedure/component
2. Confirm tests FAIL
3. Implement to pass tests
4. Refactor if needed

---

## Deployment Strategy

1. All code deployed behind `ADVANCED_EMPLOYER_DASHBOARD` flag (OFF)
2. No database migrations — zero-risk deployment
3. Enable for internal team → beta users → gradual rollout
4. Existing dashboard unchanged when flag is OFF (EC-7 / NFR-4)

---

## Risks & Mitigation

| Risk                                    | Impact             | Mitigation                                                            |
| --------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| Pipeline query slow for large employers | Degraded UX        | Use database-level groupBy aggregation, not client-side counting      |
| Bulk operation race conditions          | Data inconsistency | updateMany is atomic; filter to PENDING only                          |
| Comparison view reveals private data    | Privacy violation  | Explicit `select` clause — only public seeker fields                  |
| CSV export browser memory               | Browser crash      | Limit to 1,000 rows; for larger, show "Contact support"               |
| Feature flag interaction                | Broken UI          | Test both flags (ADVANCED_EMPLOYER_DASHBOARD ± MULTI_MEMBER_EMPLOYER) |

---

## Constitutional Compliance

- [x] **I. Type Safety First** — All inputs Zod-validated, tRPC end-to-end types, Prisma groupBy typed
- [x] **II. Test-Driven Development** — TDD enforced for all phases, 80%+ coverage target
- [x] **III. BYOK Architecture** — N/A (no AI agent calls in this feature)
- [x] **IV. Minimal Abstractions** — No new frameworks, just tRPC + Prisma + React
- [x] **V. Security & Privacy** — Employer ownership enforced, no private data exposure, admin role checks
- [x] **VI. Phased Rollout** — Feature flag defaults OFF, gradual enablement
- [x] **VII. Agent Autonomy** — N/A (dashboard is read-only view of agent results)
