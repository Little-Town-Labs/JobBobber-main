# Implementation Plan: Feature 8 — Private Negotiation Parameters

**Branch:** 8-private-negotiation-parameters
**Specification:** .specify/specs/8-private-negotiation-parameters/spec.md

---

## Executive Summary

Implement user-facing management of private negotiation parameters for job seekers and employers. The database schema (SeekerSettings, JobSettings) already exists. This feature adds: a PRIVATE_PARAMS feature flag, full CRUD implementation in the existing settings router stubs, complete input validation schemas, privacy boundary enforcement, and UI pages for managing settings.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     UI Layer                         │
│  /settings/private (seeker)                          │
│  /jobs/[id]/settings (employer per-posting)          │
└──────────────────┬──────────────────────────────────┘
                   │ tRPC mutations/queries
┌──────────────────▼──────────────────────────────────┐
│              settings.ts Router                      │
│  getSeekerSettings  │  updateSeekerSettings          │
│  getJobSettings     │  updateJobSettings             │
│  ┌────────────────────────────────────┐              │
│  │ assertFlagEnabled(PRIVATE_PARAMS)  │              │
│  │ Ownership check via ctx identity   │              │
│  └────────────────────────────────────┘              │
└──────────────────┬──────────────────────────────────┘
                   │ Prisma client
┌──────────────────▼──────────────────────────────────┐
│           Database (existing schema)                 │
│  SeekerSettings (1:1 JobSeeker)                      │
│  JobSettings    (1:1 JobPosting, cascade delete)     │
└─────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer        | Technology                     | Rationale                              |
| ------------ | ------------------------------ | -------------------------------------- |
| Feature Flag | Vercel Flags SDK               | Existing pattern in `src/lib/flags.ts` |
| API          | tRPC v11                       | Existing router stubs in `settings.ts` |
| Validation   | Zod                            | Already used for input schemas         |
| Database     | Prisma + PostgreSQL            | Schema already exists                  |
| UI           | Next.js App Router + shadcn/ui | Consistent with existing pages         |

No new dependencies required.

---

## Technical Decisions

### 1. No Database Migrations Needed

**Context:** SeekerSettings and JobSettings models already exist in the Prisma schema with all required fields.

**Decision:** Skip migration phase entirely.

**Rationale:** Fields like `salaryRules`, `exclusions`, `willingToTrain`, `minQualOverride` are already defined in the schema. Only the tRPC input schemas and router implementations are incomplete.

### 2. Upsert Pattern for Settings

**Context:** Settings may or may not exist when a user first visits the page.

**Decision:** Use Prisma `upsert` for all update operations. GET returns `null` for non-existent settings (not an error).

**Rationale:** Simplest approach — avoids separate create/update flows. Matches spec edge case: "User has no private settings yet: The UI shows empty/default state."

### 3. Ownership Enforcement via Context Identity

**Context:** Privacy boundary is critical — users must never see another user's private settings.

**Decision:** Settings procedures use `ctx.seeker.id` / `ctx.employer.id` from the authenticated context. No user-supplied owner ID parameter for seeker settings. For job settings, verify that the job posting belongs to `ctx.employer.id`.

**Rationale:** Eliminates IDOR vulnerabilities by design. The seeker endpoint has no ID parameter at all; the employer endpoint validates posting ownership.

### 4. Input Schema Completion

**Context:** Current `updateSeekerSettings` input is missing `salaryRules` and `exclusions`. Current `updateJobSettings` input is missing `willingToTrain` and `minQualOverride`.

**Decision:** Add missing fields with appropriate Zod constraints matching the spec (max 20 items for arrays, max 200 chars per item, max 10 for priorityAttrs).

### 5. Feature Flag Gating

**Decision:** Add `PRIVATE_PARAMS` flag to `src/lib/flags.ts`. Call `assertFlagEnabled(PRIVATE_PARAMS)` at the top of all 4 settings procedures.

---

## Implementation Phases

### Phase 1: Feature Flag + Router Implementation (Backend)

1. Add `PRIVATE_PARAMS` flag to `src/lib/flags.ts`
2. Complete input validation schemas in `settings.ts` (add missing fields, array length limits)
3. Implement `getSeekerSettings` — query by `ctx.seeker.id`, return settings or null
4. Implement `updateSeekerSettings` — upsert by `ctx.seeker.id`
5. Implement `getJobSettings` — query by jobPostingId, verify ownership via ctx.employer.id
6. Implement `updateJobSettings` — upsert by jobPostingId with ownership check
7. Add `assertFlagEnabled(PRIVATE_PARAMS)` to all 4 procedures

### Phase 2: Privacy Boundary Tests

1. Unit tests for all 4 procedures (happy path CRUD)
2. Privacy tests: employer cannot access seeker settings, seeker cannot access job settings
3. Ownership tests: employer A cannot access employer B's job settings
4. Feature flag gating tests: all procedures reject when flag is OFF
5. Validation tests: negative salary rejected, array length limits enforced, char limits

### Phase 3: UI Pages

1. Seeker private settings page (`/settings/private`)
2. Employer per-posting settings page (`/jobs/[id]/settings`)
3. Feature flag conditional rendering (hide UI when flag OFF)
4. Privacy messaging — clear labels that settings are never shared

### Phase 4: Hardening

1. Code review for privacy leaks
2. Verify settings never appear in any other router's response
3. Security review for IDOR vulnerabilities
4. E2E test stubs for critical flows

---

## Security Considerations

1. **IDOR Prevention:** Seeker settings have no ID input — identity from auth context only. Job settings verify posting ownership before read/write.
2. **Privacy Isolation:** SeekerSettings and JobSettings are in separate tables, never JOINed into public queries.
3. **No Logging of Private Data:** Settings values must not appear in error messages or logs.
4. **Feature Flag as Kill Switch:** PRIVATE_PARAMS flag can disable all endpoints without deployment.
5. **Input Validation:** Zod schemas enforce type safety, length limits, and enum constraints at the API boundary.

---

## Testing Strategy

| Type        | Scope                                           | Coverage Target           |
| ----------- | ----------------------------------------------- | ------------------------- |
| Unit        | Router procedures (CRUD, validation, ownership) | 90%+                      |
| Integration | Privacy boundary enforcement                    | 100% of privacy scenarios |
| Unit        | Feature flag gating                             | All 4 procedures          |
| E2E         | Settings CRUD flow (seeker + employer)          | Critical paths            |

**TDD Enforcement:** Tests written before implementation for each phase.

---

## Risks & Mitigation

| Risk                                 | Impact   | Mitigation                                                           |
| ------------------------------------ | -------- | -------------------------------------------------------------------- |
| Privacy leak in future feature       | Critical | Separate tables, no cross-JOINs, test coverage on privacy boundaries |
| Feature flag stuck OFF in production | Medium   | Flag defaults to false by design; toggle via Vercel dashboard        |
| Schema drift from spec               | Low      | Schema already exists and matches spec requirements                  |

---

## Constitutional Compliance

- [x] Test-first imperative followed (TDD for all phases)
- [x] Simplicity enforced (upsert pattern, existing schema, minimal new code)
- [x] Security standards met (ownership enforcement, privacy isolation)
- [x] Performance requirements addressed (single query per operation, < 200ms)
- [x] 80%+ coverage target set
