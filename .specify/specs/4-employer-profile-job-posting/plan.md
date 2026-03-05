# Implementation Plan — 4-employer-profile-job-posting

**Branch:** 4-employer-profile-job-posting
**Date:** 2026-03-05
**Spec:** .specify/specs/4-employer-profile-job-posting/spec.md
**Data Model:** .specify/specs/4-employer-profile-job-posting/data-model.md
**Contracts:** .specify/specs/4-employer-profile-job-posting/contracts/trpc-contracts.ts

---

## Executive Summary

Feature 4 delivers the employer company profile and job posting management experience. The feature expands two existing stub routers (`employersRouter`, `jobPostingsRouter`) into full implementations, adds a logo upload route handler, and creates the employer-side UI pages.

Key differences from the job seeker profile feature (Feature 3):

- **No database migration required** — all Employer, JobPosting, JobSettings, and EmployerMember models already exist in the schema
- **Status lifecycle** — job postings have a state machine (draft → active → paused → closed → filled) with enforced transitions
- **Organization-scoped access** — employer endpoints use `employerProcedure` (requires Clerk org membership) and `adminProcedure` (org:admin role)
- **No AI extraction** — no resume parsing equivalent; simpler data flow

The implementation requires:

- Expanding the existing `employersRouter` stub (3 → 4 procedures)
- Expanding the existing `jobPostingsRouter` stub (4 → 7 procedures)
- One new Next.js Route Handler (`/api/employer/logo/upload`)
- A shared employer profile mapper utility
- Employer dashboard page with company profile and job posting list
- Job posting create/edit form
- Company profile edit form

---

## Architecture Overview

```
Browser
  │
  ├─ /employer/dashboard        (employer home — company info + posting list)
  │      │
  │      ├─ CompanyProfileCard → tRPC: employers.getMe
  │      └─ JobPostingList     → tRPC: jobPostings.listMine
  │
  ├─ /employer/profile/edit     (company profile edit form)
  │      └─ CompanyProfileForm → tRPC: employers.updateProfile
  │
  ├─ /employer/postings/new     (create posting)
  │      └─ JobPostingForm     → tRPC: jobPostings.create
  │
  ├─ /employer/postings/[id]    (view/edit posting)
  │      ├─ JobPostingForm     → tRPC: jobPostings.update
  │      └─ StatusControls     → tRPC: jobPostings.updateStatus
  │
  └─ Logo upload flow
         ├─ 1. POST /api/employer/logo/upload (Vercel Blob token exchange)
         └─ 2. tRPC: employers.updateProfile({ logoUrl }) to persist
```

### Key Boundaries

- **employersRouter**: company profile CRUD. `getMe` and `updateProfile` for the owning org; `getById` for public read.
- **jobPostingsRouter**: posting CRUD + status transitions. `listMine` for the owning employer; `list` for public discovery of active postings.
- **Route Handler** (`/api/employer/logo/upload`): Vercel Blob token exchange for logo upload. Same pattern as `/api/resume/upload`.
- **JobSettings**: created automatically alongside each posting (empty defaults). UI gated behind `PRIVATE_PARAMS` flag — not built in this feature.

---

## Technology Stack

All choices are mandated by the project constitution and Feature 1/2 foundation.

| Concern             | Choice                           | Rationale                                  |
| ------------------- | -------------------------------- | ------------------------------------------ |
| Type safety         | tRPC 11 + Zod                    | Constitution Article I; already in project |
| Database ORM        | Prisma + `@prisma/client`        | Constitution; Feature 1                    |
| Logo storage        | Vercel Blob                      | Same pattern as resume upload (Feature 3)  |
| Skills autocomplete | `src/lib/skills-data.ts`         | Shared with Feature 3; already implemented |
| Form management     | `react-hook-form` + Zod resolver | Matches Feature 3 patterns                 |
| Testing             | Vitest + Playwright              | Constitution Article II; Feature 1         |

---

## Technical Decisions

### Decision 1: No Database Migration

The Prisma schema already contains all models needed: `Employer`, `JobPosting`, `JobSettings`, `EmployerMember`. No new fields or tables are required. This simplifies the implementation — Phase 0 is eliminated.

---

### Decision 2: Status Transition Validation — Server-Side Enum

**Chosen:** A `VALID_TRANSITIONS` map in the router, validated before any status write.

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "CLOSED", "FILLED"],
  PAUSED: ["ACTIVE", "CLOSED", "FILLED"],
  CLOSED: [],
  FILLED: [],
}
```

Invalid transitions throw `TRPCError({ code: "BAD_REQUEST" })`. This keeps the state machine in a single, testable location.

**Alternative considered:** Prisma middleware to enforce transitions at the DB layer. Rejected because it adds complexity with no benefit — the router already gates all writes.

---

### Decision 3: Logo Upload — Same Pattern as Resume

**Chosen:** Reuse the Vercel Blob `handleUpload` pattern from `/api/resume/upload`.

The route handler validates:

- Auth (Clerk `auth()`)
- Employer org membership
- MIME type (PNG, JPEG, WebP only)
- File size (max 2 MB)

Logo URLs are public by design (company logos are shown to all users). The URL is persisted via `employers.updateProfile({ logoUrl })` after upload.

---

### Decision 4: Activation Gate — Minimum Fields for Active Status

**Chosen:** Validate required fields in the `updateStatus` procedure when transitioning to ACTIVE.

Required for activation: `title` (non-empty), `description` (non-empty), at least 1 `requiredSkill`. This is checked in the router, not in a shared utility (unlike profile completeness for seekers), because the activation check is simple and posting-specific.

---

### Decision 5: Employer Profile Output — Shared Mapper

**Chosen:** Create `src/server/api/helpers/employer-mapper.ts` following the same pattern as `profile-mapper.ts` from Feature 3.

Two mapper functions:

- `toFullEmployer()` — all fields except BYOK keys; returned to owning org members
- `toPublicEmployer()` — same but omits `createdAt`

---

### Decision 6: JobSettings Auto-Creation

**Chosen:** Create a `JobSettings` row with defaults whenever a `JobPosting` is created.

The `jobPostings.create` procedure creates both the posting and its settings in a `$transaction`. The settings are populated with empty/default values. This ensures the settings row always exists when Feature 8 (Private Negotiation Parameters) ships.

---

### Decision 7: Posting Deletion — Hard Delete, Draft Only

**Chosen:** Only DRAFT postings can be deleted. Active/paused/closed/filled postings are preserved for record-keeping (they may have matches in Feature 5+). Draft postings are hard-deleted along with their JobSettings (cascade).

---

## Implementation Phases

### Phase 1: Shared Utilities

**Files:**

- `src/server/api/helpers/employer-mapper.ts`
- `src/lib/job-posting-status.ts`

**Changes:**

1. Create `toFullEmployer()` and `toPublicEmployer()` mapper functions
2. Create `toFullJobPosting()` and `toPublicJobPosting()` mapper functions
3. Create `VALID_TRANSITIONS` map and `canTransition(from, to)` helper
4. Create `canActivate(posting)` validation helper

---

### Phase 2: tRPC Routers

**Files:**

- `src/server/api/routers/employers.ts` (expand stub)
- `src/server/api/routers/employers.test.ts` (new)
- `src/server/api/routers/jobPostings.ts` (expand stub)
- `src/server/api/routers/jobPostings.test.ts` (new)

**Employer procedures:**

1. `getMe` — return `FullEmployerProfile` for the authenticated employer
2. `getById` — return `PublicEmployerProfile` for any employer by ID
3. `updateProfile` — partial update (admin only); validate URLs, persist changes
4. `updateLogo` — persist logo URL after Vercel Blob upload (admin only)

**Job posting procedures:**

1. `listMine` — paginated list of own postings, filterable by status
2. `list` — public paginated list of ACTIVE postings only, with filters
3. `getById` — return posting (public if active; full if own employer)
4. `create` — create posting + JobSettings in transaction
5. `update` — partial update of posting fields
6. `updateStatus` — transition status with validation
7. `delete` — hard delete draft postings only

---

### Phase 3: Route Handler

**Files:**

- `src/app/api/employer/logo/upload/route.ts`
- `tests/unit/api/employer-logo-upload.test.ts`

**Changes:**

1. Vercel Blob `handleUpload` — same pattern as resume upload
2. Validate: PNG/JPEG/WebP, max 2 MB, auth + employer org membership
3. `onUploadCompleted` is empty — URL persisted via tRPC `employers.updateProfile`

---

### Phase 4: Frontend — Employer Dashboard & Profile

**Files:**

- `src/app/(employer)/dashboard/page.tsx`
- `src/app/(employer)/dashboard/loading.tsx`
- `src/app/(employer)/dashboard/error.tsx`
- `src/app/(employer)/profile/edit/page.tsx`
- `src/components/employer/company-profile-card.tsx`
- `src/components/employer/company-profile-form.tsx`
- `src/components/employer/logo-upload.tsx`
- Tests in `tests/unit/components/employer/` and `tests/unit/app/employer/`

**Changes:**

1. Dashboard page — shows company profile summary card + job posting list
2. Company profile edit page — form for all company fields
3. Logo upload component — file input with type/size validation, Vercel Blob upload
4. Company profile card — read-only summary with "Edit" link

---

### Phase 5: Frontend — Job Posting Management

**Files:**

- `src/app/(employer)/postings/new/page.tsx`
- `src/app/(employer)/postings/[id]/page.tsx`
- `src/app/(employer)/postings/[id]/edit/page.tsx`
- `src/components/employer/job-posting-form.tsx`
- `src/components/employer/job-posting-list.tsx`
- `src/components/employer/job-posting-card.tsx`
- `src/components/employer/status-badge.tsx`
- `src/components/employer/status-controls.tsx`
- Tests in `tests/unit/components/employer/`

**Changes:**

1. Job posting form — shared between create and edit
2. Posting list — filterable by status, sorted by updatedAt
3. Posting card — title, status badge, creation date
4. Status controls — transition buttons with validation messaging
5. Skills autocomplete — reuse `SKILLS` list from Feature 3

---

### Phase 6: Security & Hardening

**Checklist:**

- [ ] `byokApiKeyEncrypted` never in any response object
- [ ] `JobSettings` fields never in any public response
- [ ] `employerProcedure` enforced on all mutating endpoints
- [ ] `adminProcedure` enforced on profile updates and logo
- [ ] Status transitions validated server-side (cannot be bypassed)
- [ ] Logo upload validates MIME type and size before token issuance
- [ ] Salary max ≥ salary min validated in Zod schema
- [ ] No `console.log` in production code
- [ ] TypeScript strict mode passes

---

### Phase 7: Integration, E2E & Review

**Files:**

- `tests/integration/employer.test.ts`
- `tests/integration/job-posting.test.ts`
- `tests/e2e/employer-profile.spec.ts`
- `tests/e2e/job-posting.spec.ts`

**Integration test scenarios:**

- Create employer, update profile, verify DB state
- `getMe` returns full profile; `getById` returns public profile (no BYOK fields)
- Create posting + auto-created JobSettings
- Status transitions: valid transitions succeed; invalid transitions throw
- Activation gate: missing required fields blocks DRAFT → ACTIVE
- Delete: draft deletion works; active deletion blocked

**E2E flows:**

- Employer creates company profile → creates posting → activates posting
- Employer filters posting list by status
- Status transition: pause → reactivate → close

---

## Security Considerations

| Threat                      | Mitigation                                                          |
| --------------------------- | ------------------------------------------------------------------- |
| BYOK key exposure           | Never included in any mapper; omitted from all Prisma `select`      |
| JobSettings exposure        | Never returned in public procedures; separate model                 |
| Unauthorized profile edit   | `adminProcedure` requires org:admin role                            |
| Status manipulation         | Server-side transition map; client cannot set arbitrary status      |
| Logo SSRF                   | Logo URLs are public; no server-side fetching of user-provided URLs |
| Salary data inconsistency   | Zod schema validates `salaryMax >= salaryMin`                       |
| XSS in description/whyApply | React auto-escapes; no `dangerouslySetInnerHTML`                    |

---

## Performance Strategy

- **Posting list pagination**: Cursor-based pagination using `id` as cursor; indexed query on `(status, employerId)`
- **No N+1 queries**: Posting list is a single Prisma query with `where` + `orderBy` + `take` + `cursor`
- **Logo upload**: Direct browser-to-CDN upload via Vercel Blob (no server memory pressure)
- **Static skills data**: Client-side filtering from `skills-data.ts` (no API call)

---

## Testing Strategy

| Layer            | Coverage Target | Focus                                          |
| ---------------- | --------------- | ---------------------------------------------- |
| Unit (Vitest)    | 80%+            | Router procedures, status transitions, mappers |
| Integration      | Key flows       | Full router stack with test DB                 |
| E2E (Playwright) | Critical paths  | Profile creation, posting lifecycle            |

All tests use mocked Prisma client (unit) or test Postgres (integration). No real Clerk or Vercel Blob calls in any test.

---

## Risks & Mitigation

| Risk                              | Impact                                | Mitigation                                              |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| Clerk org membership not synced   | Employer can't access profile         | Verify org sync in onboarding flow (Feature 2)          |
| Status state machine complexity   | Edge cases in transitions             | Exhaustive test cases for all valid/invalid transitions |
| JobSettings auto-creation failure | Missing settings when Feature 8 ships | Wrap in `$transaction`; test explicitly                 |

---

## Constitutional Compliance

- [x] **Type Safety (I):** All fields flow through Zod schemas; enums enforced at DB + API layers
- [x] **TDD (II):** Tests written first; 80%+ coverage required
- [x] **BYOK (III):** BYOK fields exist on Employer but never exposed; no new BYOK functionality in this feature
- [x] **Minimal Abstractions (IV):** Direct Prisma queries; shared mappers only
- [x] **Security & Privacy (V):** JobSettings in separate model; BYOK keys excluded from all responses
- [x] **Feature Flags (VI):** `EMPLOYER_PROFILE` gates employer UI; `PRIVATE_PARAMS` gates JobSettings UI
- [x] **Agent Autonomy (VII):** Posting activation is the future trigger for Feature 5 matching
