# Task Breakdown — 4-employer-profile-job-posting

**Branch:** 4-employer-profile-job-posting
**Plan:** .specify/specs/4-employer-profile-job-posting/plan.md
**Date:** 2026-03-05

---

## Phase 1: Shared Utilities

### Task 1.1: Employer Mapper & Status Helpers — Tests

**Status:** ✅ Complete
**Effort:** 2 hours
**Dependencies:** None

**Description:**
Write tests for employer mapper functions (`toFullEmployer`, `toPublicEmployer`, `toFullJobPosting`, `toPublicJobPosting`) and status helpers (`canTransition`, `canActivate`). **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Tests for `toFullEmployer` — includes all fields except BYOK keys
- [ ] Tests for `toPublicEmployer` — omits `createdAt` and BYOK keys
- [ ] Tests for `toFullJobPosting` — includes all posting fields
- [ ] Tests for `toPublicJobPosting` — omits `createdAt`
- [ ] Tests for `canTransition` — all valid transitions return true
- [ ] Tests for `canTransition` — all invalid transitions return false (terminal states, skip states)
- [ ] Tests for `canActivate` — returns false when title/description empty or no requiredSkills
- [ ] Tests for `canActivate` — returns true when all required fields present
- [ ] All tests confirmed to FAIL

---

### Task 1.2: Employer Mapper & Status Helpers — Implementation

**Status:** ✅ Complete by 1.1
**Effort:** 1.5 hours
**Dependencies:** Task 1.1

**Description:**
Implement `src/server/api/helpers/employer-mapper.ts` and `src/lib/job-posting-status.ts`.

**Acceptance Criteria:**

- [ ] `toFullEmployer()` maps Prisma Employer row, excludes `byokApiKeyEncrypted`, `byokProvider`, `byokKeyValidatedAt`, `byokMaskedKey`
- [ ] `toPublicEmployer()` same as full but also excludes `createdAt`
- [ ] `toFullJobPosting()` maps Prisma JobPosting row
- [ ] `toPublicJobPosting()` excludes `createdAt`
- [ ] `VALID_TRANSITIONS` map matches spec state machine
- [ ] `canTransition(from, to)` returns boolean
- [ ] `canActivate(posting)` validates title, description, requiredSkills.length >= 1
- [ ] All tests from 1.1 pass

---

## Phase 2: tRPC Routers

### Task 2.1: Employers Router — Tests

**Status:** ✅ Complete by 1.2
**Effort:** 3 hours
**Dependencies:** Task 1.2

**Description:**
Write tests for all 4 employer procedures: `getMe`, `getById`, `updateProfile`, `updateLogo`. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `getMe` — returns FullEmployerProfile for authenticated employer
- [ ] `getMe` — returns null/error for non-existent employer
- [ ] `getById` — returns PublicEmployerProfile (no createdAt, no BYOK fields)
- [ ] `getById` — returns null for non-existent ID
- [ ] `updateProfile` — partial update works (single field)
- [ ] `updateProfile` — validates URL format for websiteUrl
- [ ] `updateProfile` — enforces admin role (rejects non-admin)
- [ ] `updateProfile` — validates field constraints (name min 1, max 255; description max 5000)
- [ ] `updateLogo` — persists logoUrl on employer record
- [ ] `updateLogo` — enforces admin role
- [ ] BYOK fields never appear in any response
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 2.3

---

### Task 2.2: Employers Router — Implementation

**Status:** ✅ Complete by 2.1
**Effort:** 2.5 hours
**Dependencies:** Task 2.1

**Description:**
Expand `src/server/api/routers/employers.ts` stub into full implementation with 4 procedures.

**Acceptance Criteria:**

- [ ] `getMe` — employerProcedure, returns `toFullEmployer()` using ctx.employer
- [ ] `getById` — publicProcedure, returns `toPublicEmployer()` by ID
- [ ] `updateProfile` — adminProcedure, Zod input schema with all optional fields, partial Prisma update
- [ ] `updateLogo` — adminProcedure, accepts logoUrl string, updates employer record
- [ ] Prisma `select` excludes BYOK fields in all queries
- [ ] All tests from 2.1 pass

**Parallel with:** Task 2.4

---

### Task 2.3: Job Postings Router — Tests

**Status:** ✅ Complete by 1.2
**Effort:** 4 hours
**Dependencies:** Task 1.2

**Description:**
Write tests for all 7 job posting procedures. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] `listMine` — returns paginated list of own postings, filterable by status
- [ ] `listMine` — cursor-based pagination works correctly
- [ ] `list` — returns only ACTIVE postings for public access
- [ ] `list` — filters by experienceLevel and locationType
- [ ] `getById` — returns full posting for owning employer
- [ ] `getById` — returns public posting for non-owner (active only)
- [ ] `getById` — returns error for non-active posting accessed by non-owner
- [ ] `create` — creates posting + JobSettings in transaction
- [ ] `create` — defaults status to DRAFT
- [ ] `create` — validates salaryMax >= salaryMin
- [ ] `update` — partial update works
- [ ] `update` — only owning employer can update
- [ ] `updateStatus` — valid transitions succeed (DRAFT→ACTIVE, ACTIVE→PAUSED, etc.)
- [ ] `updateStatus` — invalid transitions rejected (CLOSED→ACTIVE, FILLED→anything)
- [ ] `updateStatus` — DRAFT→ACTIVE blocked when missing title/description/requiredSkills
- [ ] `delete` — DRAFT posting deleted with cascade to JobSettings
- [ ] `delete` — non-DRAFT posting deletion rejected
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 2.1

---

### Task 2.4: Job Postings Router — Implementation

**Status:** ✅ Complete by 2.3
**Effort:** 3.5 hours
**Dependencies:** Task 2.3

**Description:**
Expand `src/server/api/routers/jobPostings.ts` stub into full implementation with 7 procedures.

**Acceptance Criteria:**

- [ ] `listMine` — employerProcedure, cursor pagination, status filter, ordered by updatedAt desc
- [ ] `list` — publicProcedure, only ACTIVE, cursor pagination, experienceLevel/locationType filters
- [ ] `getById` — publicProcedure with ownership check (full if own, public if active, error otherwise)
- [ ] `create` — employerProcedure, `$transaction` creating JobPosting + JobSettings with defaults
- [ ] `update` — employerProcedure, ownership check, partial update with Zod schema
- [ ] `updateStatus` — employerProcedure, ownership check, `canTransition` + `canActivate` validation
- [ ] `delete` — employerProcedure, ownership check, DRAFT-only, hard delete
- [ ] Zod schemas validate salaryMax >= salaryMin via `.refine()`
- [ ] All tests from 2.3 pass

**Parallel with:** Task 2.2

---

## Phase 3: Route Handler

### Task 3.1: Logo Upload Route Handler — Tests

**Status:** ✅ Complete by 1.2
**Effort:** 1.5 hours
**Dependencies:** Task 1.2

**Description:**
Write tests for `POST /api/employer/logo/upload` route handler. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Accepts PNG, JPEG, WebP MIME types
- [ ] Rejects non-image MIME types
- [ ] Enforces 2 MB max file size
- [ ] Requires authentication (401 without auth)
- [ ] Requires employer org membership
- [ ] Returns proper Vercel Blob upload response shape
- [ ] All tests confirmed to FAIL

**Parallel with:** Tasks 2.1, 2.3

---

### Task 3.2: Logo Upload Route Handler — Implementation

**Status:** ✅ Complete by 3.1
**Effort:** 1 hour
**Dependencies:** Task 3.1

**Description:**
Create `src/app/api/employer/logo/upload/route.ts` using Vercel Blob `handleUpload` pattern.

**Acceptance Criteria:**

- [ ] Uses same pattern as `/api/resume/upload`
- [ ] Validates MIME type (image/png, image/jpeg, image/webp)
- [ ] Validates file size (max 2 MB)
- [ ] Auth check via `auth()` from Clerk
- [ ] Employer org membership check
- [ ] `onUploadCompleted` is empty (URL persisted via tRPC)
- [ ] All tests from 3.1 pass

---

## Phase 4: Frontend — Employer Dashboard & Profile

### Task 4.1: Company Profile Components — Tests

**Status:** ✅ Complete by 2.2
**Effort:** 2 hours
**Dependencies:** Task 2.2

**Description:**
Write tests for CompanyProfileCard, CompanyProfileForm, and LogoUpload components. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] CompanyProfileCard renders company info fields
- [ ] CompanyProfileCard shows "Edit" link
- [ ] CompanyProfileForm renders all editable fields
- [ ] CompanyProfileForm validates required company name
- [ ] LogoUpload validates file type and size client-side
- [ ] LogoUpload shows preview after selection
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 4.3

---

### Task 4.2: Company Profile Components — Implementation

**Status:** ✅ Complete by 4.1
**Effort:** 3 hours
**Dependencies:** Task 4.1

**Description:**
Create employer profile components.

**Acceptance Criteria:**

- [ ] `src/components/employer/company-profile-card.tsx` — read-only summary
- [ ] `src/components/employer/company-profile-form.tsx` — react-hook-form + Zod
- [ ] `src/components/employer/logo-upload.tsx` — file input with validation
- [ ] All tests from 4.1 pass

**Parallel with:** Task 4.4

---

### Task 4.3: Employer Dashboard & Profile Pages — Tests

**Status:** ✅ Complete by 2.2
**Effort:** 1.5 hours
**Dependencies:** Task 2.2

**Description:**
Write tests for employer dashboard and profile edit pages. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] Dashboard page renders company profile card and posting list
- [ ] Dashboard shows empty state when no postings
- [ ] Profile edit page renders form with current data
- [ ] Loading and error states render correctly
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 4.1

---

### Task 4.4: Employer Dashboard & Profile Pages — Implementation

**Status:** ✅ Complete by 4.2, 4.3
**Effort:** 2.5 hours
**Dependencies:** Tasks 4.2, 4.3

**Description:**
Create employer dashboard and profile edit pages.

**Acceptance Criteria:**

- [ ] `src/app/(employer)/dashboard/page.tsx` — server component with tRPC calls
- [ ] `src/app/(employer)/dashboard/loading.tsx` — skeleton loading state
- [ ] `src/app/(employer)/dashboard/error.tsx` — error boundary (no server detail leak)
- [ ] `src/app/(employer)/profile/edit/page.tsx` — profile form page
- [ ] All tests from 4.3 pass

---

## Phase 5: Frontend — Job Posting Management

### Task 5.1: Job Posting Components — Tests

**Status:** ✅ Complete by 2.4
**Effort:** 3 hours
**Dependencies:** Task 2.4

**Description:**
Write tests for JobPostingForm, JobPostingList, JobPostingCard, StatusBadge, and StatusControls. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] JobPostingForm validates required fields (title, description)
- [ ] JobPostingForm validates salaryMax >= salaryMin
- [ ] JobPostingForm skills autocomplete uses shared SKILLS list
- [ ] JobPostingList renders postings filtered by status
- [ ] JobPostingList shows empty state with CTA
- [ ] JobPostingCard displays title, status badge, date
- [ ] StatusBadge renders correct colors for each status
- [ ] StatusControls shows valid transition buttons only
- [ ] StatusControls shows activation error when fields missing
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 4.1, 4.3

---

### Task 5.2: Job Posting Components — Implementation

**Status:** ✅ Complete by 5.1
**Effort:** 4 hours
**Dependencies:** Task 5.1

**Description:**
Create job posting management components.

**Acceptance Criteria:**

- [ ] `src/components/employer/job-posting-form.tsx` — shared create/edit form
- [ ] `src/components/employer/job-posting-list.tsx` — filterable list
- [ ] `src/components/employer/job-posting-card.tsx` — summary card
- [ ] `src/components/employer/status-badge.tsx` — color-coded status
- [ ] `src/components/employer/status-controls.tsx` — transition buttons
- [ ] Skills autocomplete reuses `SKILLS` from `src/lib/skills-data.ts`
- [ ] All tests from 5.1 pass

---

### Task 5.3: Job Posting Pages — Tests

**Status:** ✅ Complete by 2.4
**Effort:** 1.5 hours
**Dependencies:** Task 2.4

**Description:**
Write tests for posting create, view, and edit pages. **TESTS FIRST.**

**Acceptance Criteria:**

- [ ] New posting page renders empty form
- [ ] View posting page renders posting details with status controls
- [ ] Edit posting page pre-fills form with existing data
- [ ] All tests confirmed to FAIL

**Parallel with:** Task 5.1

---

### Task 5.4: Job Posting Pages — Implementation

**Status:** ✅ Complete by 5.2, 5.3
**Effort:** 2.5 hours
**Dependencies:** Tasks 5.2, 5.3

**Description:**
Create job posting management pages.

**Acceptance Criteria:**

- [ ] `src/app/(employer)/postings/new/page.tsx` — create posting
- [ ] `src/app/(employer)/postings/[id]/page.tsx` — view posting with status controls
- [ ] `src/app/(employer)/postings/[id]/edit/page.tsx` — edit posting
- [ ] All tests from 5.3 pass

---

## Phase 6: Security & Hardening

### Task 6.1: Security Review

**Status:** ✅ Complete by 2.2, 2.4, 3.2
**Effort:** 2 hours
**Dependencies:** Tasks 2.2, 2.4, 3.2

**Description:**
Run security review on all new router and route handler code.

**Acceptance Criteria:**

- [ ] `byokApiKeyEncrypted` never in any response object
- [ ] `JobSettings` fields never in any public response
- [ ] `employerProcedure` enforced on all mutating endpoints
- [ ] `adminProcedure` enforced on profile updates and logo
- [ ] Status transitions validated server-side
- [ ] Logo upload validates MIME type and size before token issuance
- [ ] Salary max >= salary min validated in Zod schema
- [ ] No `console.log` in production code
- [ ] TypeScript strict mode passes
- [ ] Error messages don't leak server internals

---

## Phase 7: Integration, E2E & Review

### Task 7.1: Integration Tests

**Status:** 🔴 Blocked by NeonDB
**Effort:** 3 hours
**Dependencies:** Task 6.1, NeonDB availability

**Description:**
Write integration tests against test database.

**Acceptance Criteria:**

- [ ] Create employer, update profile, verify DB state
- [ ] `getMe` returns full profile; `getById` returns public profile (no BYOK)
- [ ] Create posting + auto-created JobSettings verified in DB
- [ ] Status transitions: all valid succeed, all invalid throw
- [ ] Activation gate: missing fields blocks DRAFT→ACTIVE
- [ ] Delete: draft deletion works; active deletion blocked
- [ ] Salary validation enforced end-to-end

---

### Task 7.2: E2E Tests

**Status:** 🔴 Blocked by NeonDB
**Effort:** 3 hours
**Dependencies:** Task 7.1

**Description:**
Write Playwright E2E tests for critical employer flows.

**Acceptance Criteria:**

- [ ] Employer creates company profile → creates posting → activates posting
- [ ] Employer filters posting list by status
- [ ] Status transitions: pause → reactivate → close
- [ ] Logo upload flow completes successfully
- [ ] Delete draft posting with confirmation

---

### Task 7.3: Code Review

**Status:** ✅ Complete
**Effort:** 1.5 hours
**Dependencies:** Tasks 5.4, 6.1

**Description:**
Run code review on all Feature 4 code.

**Acceptance Criteria:**

- [ ] No CRITICAL or HIGH issues remaining
- [ ] MEDIUM issues addressed where possible
- [ ] Code follows existing codebase patterns
- [ ] No unused imports or dead code

---

## Summary

- **Total Tasks:** 20
- **Phases:** 7
- **Total Effort:** ~46 hours
- **Estimated Duration:** ~6 days (with parallelization)

### Parallelization Opportunities

- Phase 1: Task 1.1 is the only entry point
- Phase 2: Tasks 2.1/2.3 parallel (independent routers); Tasks 2.2/2.4 parallel
- Phase 3: Task 3.1 parallel with Phase 2 tests (both depend on 1.2)
- Phase 4: Tasks 4.1/4.3 parallel (components vs pages tests)
- Phase 5: Tasks 5.1/5.3 parallel; Tasks 5.1/4.1/4.3 parallel across phases

### Critical Path

Task 1.1 → 1.2 → 2.3 → 2.4 → 5.1 → 5.2 → 5.4 → 6.1 → 7.1 → 7.2
**Duration:** ~28 hours on critical path

### Quality Gates

- [ ] TDD enforced (tests before implementation)
- [ ] Security review at Phase 6
- [ ] Code review before merge (Task 7.3)
- [ ] E2E tests validate all user stories
- [ ] BYOK fields verified absent from all responses

### User Story → Task Mapping

| User Story                  | Tasks                        |
| --------------------------- | ---------------------------- |
| US1: Create Company Profile | 2.1, 2.2, 4.1–4.4            |
| US2: Create Job Posting     | 2.3, 2.4, 5.1–5.4            |
| US3: Manage Posting Status  | 1.1, 1.2, 2.3, 2.4, 5.1, 5.2 |
| US4: Edit Job Posting       | 2.3, 2.4, 5.1–5.4            |
| US5: View Posting List      | 2.3, 2.4, 5.1, 5.2, 4.3, 4.4 |
| US6: Update Company Profile | 2.1, 2.2, 4.1–4.4, 3.1, 3.2  |
| US7: Delete Job Posting     | 2.3, 2.4                     |

### Next Steps

1. Review task breakdown
2. Run `/speckit-implement` to begin execution
3. Commit: `git commit -m "docs: add task breakdown for 4-employer-profile-job-posting"`
