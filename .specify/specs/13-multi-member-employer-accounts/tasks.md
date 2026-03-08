# Task Breakdown: Multi-Member Employer Accounts

**Feature Branch**: `13-multi-member-employer-accounts`
**Plan**: `plan.md`
**Created**: 2026-03-08

---

## Phase 1: Schema & Middleware (Foundation)

### Task 1.1: Prisma Schema — Add Invitation and ActivityLog Models

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** None
**User Stories:** US1, US4
**FRs:** FR-007, FR-008, FR-011

**Description:**
Add `InvitationStatus` enum, `Invitation` model, and `ActivityLog` model to `prisma/schema.prisma`. Add relations to `Employer`. Add all indexes per data-model.md. Run `prisma generate` (do not run migration — no DB available in dev).

**Acceptance Criteria:**

- [ ] `InvitationStatus` enum with PENDING, ACCEPTED, EXPIRED, REVOKED
- [ ] `Invitation` model with all fields from data-model.md
- [ ] `ActivityLog` model with all fields from data-model.md
- [ ] Relations added to `Employer` model (`invitations`, `activityLogs`)
- [ ] All indexes defined per data-model.md
- [ ] `prisma generate` succeeds

---

### Task 1.2: Feature Flag — Add MULTI_MEMBER_EMPLOYER

**Status:** 🟡 Ready
**Effort:** 0.5h
**Dependencies:** None
**Parallel with:** Task 1.1
**User Stories:** All
**FRs:** FR-012

**Description:**
Add `MULTI_MEMBER_EMPLOYER` feature flag to `src/lib/flags.ts` following the existing pattern.

**Acceptance Criteria:**

- [ ] Flag defined with `key: "multi-member-employer"`, `defaultValue: false`
- [ ] Description references Feature 13
- [ ] Pattern matches existing flags exactly

---

### Task 1.3: Middleware — Tests for Enhanced employerProcedure and jobPosterProcedure

**Status:** 🟡 Ready
**Effort:** 2h
**Dependencies:** Task 1.1
**User Stories:** US2, US5
**FRs:** FR-003, FR-009

**Description:**
Write tests for the enhanced middleware chain. **TESTS FIRST (TDD).**

Test cases:

- `employerProcedure` loads `ctx.member` from `EmployerMember` table
- `employerProcedure` allows ADMIN, JOB_POSTER, and VIEWER roles
- `jobPosterProcedure` allows ADMIN and JOB_POSTER, rejects VIEWER
- `adminProcedure` allows only ADMIN (existing behavior preserved)
- Backward compat: single-user employer (existing ADMIN member) passes all tiers
- Missing `EmployerMember` record throws FORBIDDEN

**Acceptance Criteria:**

- [ ] Tests for all 3 roles × 3 procedure tiers (9 test cases minimum)
- [ ] Backward compatibility test for existing single-user accounts
- [ ] Tests confirmed to FAIL before implementation

---

### Task 1.4: Middleware — Implement Enhanced employerProcedure and jobPosterProcedure

**Status:** 🔴 Blocked by 1.3
**Effort:** 1.5h
**Dependencies:** Task 1.1, Task 1.3
**User Stories:** US2, US5
**FRs:** FR-003, FR-009

**Description:**
Modify `enforceEmployer` middleware in `src/server/api/trpc.ts` to also load the `EmployerMember` record and add it to context as `ctx.member`. Add `enforceJobPoster` middleware that checks `ctx.member.role !== 'VIEWER'`. Export `jobPosterProcedure`.

**Acceptance Criteria:**

- [ ] `ctx.member` available in employer context with `id`, `role`, `clerkUserId`
- [ ] `jobPosterProcedure` exported and usable
- [ ] All tests from Task 1.3 pass
- [ ] Existing `adminProcedure` still works (chains off employer)
- [ ] `testHelpers.callJobPoster` added for test support

---

## Phase 2: Team Router (Core API)

### Task 2.1: Activity Logger Utility — Tests

**Status:** 🟡 Ready
**Effort:** 1h
**Dependencies:** Task 1.1
**Parallel with:** Task 1.3
**User Stories:** US4
**FRs:** FR-008

**Description:**
Write tests for `logActivity()` utility. **TESTS FIRST (TDD).**

Test cases:

- Creates ActivityLog record with correct fields
- Swallows errors without throwing (fire-and-forget)
- Handles missing optional fields (targetType, targetId, targetLabel)

**Acceptance Criteria:**

- [ ] Tests for success case, error swallowing, and optional fields
- [ ] Tests confirmed to FAIL before implementation

---

### Task 2.2: Activity Logger Utility — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 0.5h
**Dependencies:** Task 2.1
**User Stories:** US4
**FRs:** FR-008

**Description:**
Create `src/lib/activity-log.ts` with a `logActivity()` function that writes to the `ActivityLog` table. Accepts employer context, action string, and optional target info. Catches and ignores errors.

**Acceptance Criteria:**

- [ ] `logActivity()` exported and type-safe
- [ ] Error swallowing verified (does not throw on DB failure)
- [ ] All tests from Task 2.1 pass

---

### Task 2.3: Team Router — Tests for listMembers and invite

**Status:** 🔴 Blocked by 1.4
**Effort:** 2h
**Dependencies:** Task 1.4
**User Stories:** US1, US3
**FRs:** FR-001, FR-002, FR-007

**Description:**
Write tests for `team.listMembers` and `team.invite` procedures. **TESTS FIRST (TDD).**

Test cases for `listMembers`:

- Returns all members with roles and join dates
- Accessible by all employer roles (ADMIN, JOB_POSTER, VIEWER)
- Returns member names and emails

Test cases for `invite`:

- Admin can invite with valid email and role
- Non-admin is rejected (FORBIDDEN)
- Duplicate invitation to same email is rejected
- Invalid email format is rejected
- Clerk Organizations API called with correct params
- Invitation record created in DB with PENDING status
- Activity log entry created

**Acceptance Criteria:**

- [ ] Tests for both procedures covering happy path and errors
- [ ] Clerk API mocked
- [ ] Tests confirmed to FAIL before implementation

---

### Task 2.4: Team Router — Implement listMembers and invite

**Status:** 🔴 Blocked by 2.3
**Effort:** 2h
**Dependencies:** Task 2.2, Task 2.3
**User Stories:** US1, US3
**FRs:** FR-001, FR-002, FR-007

**Description:**
Create `src/server/api/routers/team.ts` with `listMembers` (employerProcedure) and `invite` (adminProcedure) procedures. Wire to Clerk Organizations invitation API. Create invitation record in DB. Log activity.

**Acceptance Criteria:**

- [ ] `listMembers` returns member list with names from EmployerMember records
- [ ] `invite` creates Clerk invitation and DB Invitation record
- [ ] Activity logged for invitations
- [ ] All tests from Task 2.3 pass

---

### Task 2.5: Team Router — Tests for updateRole and removeMember

**Status:** 🔴 Blocked by 1.4
**Effort:** 2h
**Dependencies:** Task 1.4
**Parallel with:** Task 2.3
**User Stories:** US3
**FRs:** FR-004, FR-005, FR-006

**Description:**
Write tests for `team.updateRole` and `team.removeMember` procedures. **TESTS FIRST (TDD).**

Test cases for `updateRole`:

- Admin can change member role
- Cannot demote last admin (FR-006)
- Non-admin rejected
- Member not found returns error
- Activity log entry created

Test cases for `removeMember`:

- Admin can remove a member
- Cannot remove last admin (FR-006)
- Non-admin rejected
- Clerk organization membership removal called
- Activity log entry created

**Acceptance Criteria:**

- [ ] Tests for both procedures, including last-admin protection
- [ ] Clerk API mocked
- [ ] Tests confirmed to FAIL before implementation

---

### Task 2.6: Team Router — Implement updateRole and removeMember

**Status:** 🔴 Blocked by 2.4, 2.5
**Effort:** 2h
**Dependencies:** Task 2.4, Task 2.5
**User Stories:** US3
**FRs:** FR-004, FR-005, FR-006

**Description:**
Add `updateRole` and `removeMember` to `teamRouter`. Both are `adminProcedure`. Implement last-admin protection using a count query inside a transaction. Call Clerk API to sync membership changes. Log activity.

**Acceptance Criteria:**

- [ ] Role change persisted in DB and synced to Clerk
- [ ] Member removal persisted and synced to Clerk
- [ ] Last-admin protection prevents demotion and removal
- [ ] All tests from Task 2.5 pass

---

### Task 2.7: Team Router — Tests for listInvitations, revokeInvitation, getActivityLog

**Status:** 🔴 Blocked by 1.4
**Effort:** 1.5h
**Dependencies:** Task 1.4
**Parallel with:** Task 2.3, 2.5
**User Stories:** US1, US4
**FRs:** FR-007, FR-008, FR-011

**Description:**
Write tests for remaining team router procedures. **TESTS FIRST (TDD).**

Test cases for `listInvitations`:

- Returns pending invitations (not expired, not revoked)
- Admin only

Test cases for `revokeInvitation`:

- Revokes pending invitation, updates status
- Calls Clerk revoke API
- Admin only
- Cannot revoke already accepted invitation

Test cases for `getActivityLog`:

- Returns paginated entries in reverse chronological order
- Cursor-based pagination works
- Admin only

**Acceptance Criteria:**

- [ ] Tests for all 3 procedures
- [ ] Tests confirmed to FAIL before implementation

---

### Task 2.8: Team Router — Implement listInvitations, revokeInvitation, getActivityLog

**Status:** 🔴 Blocked by 2.6, 2.7
**Effort:** 1.5h
**Dependencies:** Task 2.6, Task 2.7
**User Stories:** US1, US4
**FRs:** FR-007, FR-008, FR-011

**Description:**
Add remaining procedures to `teamRouter`. Register router in `src/server/api/root.ts`.

**Acceptance Criteria:**

- [ ] All 3 procedures implemented
- [ ] `teamRouter` registered in root router
- [ ] All tests from Task 2.7 pass

---

## Phase 3: Webhook Events (Sync)

### Task 3.1: Clerk Webhook — Tests for Membership Events

**Status:** 🔴 Blocked by 1.1
**Effort:** 1.5h
**Dependencies:** Task 1.1
**Parallel with:** Phase 2 tasks
**User Stories:** US1
**FRs:** FR-001, FR-002

**Description:**
Write tests for new Clerk webhook event handlers. **TESTS FIRST (TDD).**

Test cases:

- `organizationMembership.created` → creates EmployerMember record
- `organizationMembership.created` → idempotent (upsert)
- `organizationMembership.deleted` → deletes EmployerMember record
- `organizationMembership.deleted` → no-op if record doesn't exist
- `organizationInvitation.accepted` → updates Invitation status to ACCEPTED
- Unknown event types → acknowledged (200), not processed (existing behavior)

**Acceptance Criteria:**

- [ ] Tests for all 3 new event types with happy and edge cases
- [ ] Signature verification mocked (existing pattern)
- [ ] Tests confirmed to FAIL before implementation

---

### Task 3.2: Clerk Webhook — Implement Membership Event Handlers

**Status:** 🔴 Blocked by 3.1
**Effort:** 1h
**Dependencies:** Task 3.1
**User Stories:** US1
**FRs:** FR-001, FR-002

**Description:**
Extend `src/app/api/webhooks/clerk/route.ts` with handlers for `organizationMembership.created`, `organizationMembership.deleted`, and `organizationInvitation.accepted`. Use upsert for idempotency.

**Acceptance Criteria:**

- [ ] All 3 event types handled
- [ ] Upsert pattern for idempotency
- [ ] All tests from Task 3.1 pass

---

## Phase 4: Existing Router Audit (Role Enforcement)

### Task 4.1: Router Audit — Tests for Role Enforcement on Existing Endpoints

**Status:** 🔴 Blocked by 1.4
**Effort:** 2h
**Dependencies:** Task 1.4
**Parallel with:** Phase 2, Phase 3
**User Stories:** US2
**FRs:** FR-003, FR-010

**Description:**
Write tests verifying role enforcement on existing employer endpoints. **TESTS FIRST (TDD).**

Test cases per router:

- `jobPostings.create/update/updateStatus/delete` → require JOB_POSTER or ADMIN
- `jobPostings.listMine/getById` → allow all employer roles
- `employers.updateProfile/updateLogo` → require ADMIN
- `employers.getMe` → allow all employer roles
- `matches` write operations → require JOB_POSTER or ADMIN
- `matches` read operations → allow all employer roles
- `settings` employer operations → require ADMIN
- `byok` operations → require ADMIN
- `conversations` employer read → allow all employer roles

**Acceptance Criteria:**

- [ ] Tests for all employer endpoints × relevant role restrictions
- [ ] Tests confirmed to FAIL for endpoints not yet migrated

---

### Task 4.2: Router Audit — Migrate Existing Endpoints to Correct Procedure Tier

**Status:** 🔴 Blocked by 4.1
**Effort:** 1.5h
**Dependencies:** Task 4.1
**User Stories:** US2
**FRs:** FR-003

**Description:**
Audit all routers using `employerProcedure` and migrate write operations to `jobPosterProcedure`. Verify admin-only operations use `adminProcedure`.

Files to audit:

- `src/server/api/routers/jobPostings.ts` — create/update/updateStatus/delete → `jobPosterProcedure`
- `src/server/api/routers/employers.ts` — updateProfile/updateLogo already on `adminProcedure` ✓
- `src/server/api/routers/matches.ts` — write operations → `jobPosterProcedure`
- `src/server/api/routers/settings.ts` — employer settings → `adminProcedure`
- `src/server/api/routers/byok.ts` — all operations → `adminProcedure`

**Acceptance Criteria:**

- [ ] All write endpoints on correct procedure tier
- [ ] All read endpoints remain on `employerProcedure` (all roles)
- [ ] All tests from Task 4.1 pass
- [ ] Existing tests still pass (no regressions)

---

### Task 4.3: Activity Logging — Add to Existing Posting Operations

**Status:** 🔴 Blocked by 2.2, 4.2
**Effort:** 1h
**Dependencies:** Task 2.2, Task 4.2
**User Stories:** US4
**FRs:** FR-008

**Description:**
Add `logActivity()` calls to existing employer operations:

- `jobPostings.create` → `"posting.created"`
- `jobPostings.update` → `"posting.updated"`
- `jobPostings.updateStatus` → `"posting.status_changed"`
- `jobPostings.delete` → `"posting.deleted"`
- Match accept/decline → `"match.accepted"` / `"match.declined"`

**Acceptance Criteria:**

- [ ] Activity logged for all posting CRUD operations
- [ ] Activity logged for match status changes
- [ ] Existing tests still pass (activity logging is fire-and-forget)

---

## Phase 5: UI (Frontend)

### Task 5.1: Team Management Page — Tests

**Status:** 🔴 Blocked by 2.8
**Effort:** 1.5h
**Dependencies:** Task 2.8
**User Stories:** US1, US3, US5
**FRs:** FR-001, FR-004, FR-005, FR-009

**Description:**
Write component tests for the team management page. **TESTS FIRST (TDD).**

Test cases:

- Renders member list with roles
- Shows invite form for admins only
- Shows role change controls for admins only
- Shows remove button for admins only (not on self if last admin)
- Loading state renders skeleton
- Error state renders error message
- Single-user employer sees themselves as admin

**Acceptance Criteria:**

- [ ] Tests for admin view, non-admin view, and single-user view
- [ ] tRPC calls mocked
- [ ] Tests confirmed to FAIL before implementation

---

### Task 5.2: Team Management Page — Implementation

**Status:** 🔴 Blocked by 5.1
**Effort:** 2h
**Dependencies:** Task 5.1
**User Stories:** US1, US3, US5
**FRs:** FR-001, FR-004, FR-005, FR-009

**Description:**
Create `src/app/(employer)/dashboard/team/page.tsx` with:

- Member list table (name, email, role, joined date)
- Invite form (email + role select) — visible only to admins
- Role change dropdown per member — visible only to admins
- Remove button per member — visible only to admins
- Pending invitations section with revoke buttons

**Acceptance Criteria:**

- [ ] All team management functionality rendered
- [ ] Admin-only controls hidden for non-admins
- [ ] All tests from Task 5.1 pass

---

### Task 5.3: Activity Log Panel — Tests

**Status:** 🔴 Blocked by 2.8
**Effort:** 1h
**Dependencies:** Task 2.8
**Parallel with:** Task 5.1
**User Stories:** US4
**FRs:** FR-008

**Description:**
Write component tests for the activity log panel. **TESTS FIRST (TDD).**

Test cases:

- Renders activity entries with actor, action, target, timestamp
- Cursor-based pagination ("Load more" button)
- Empty state when no activity
- Only visible to admins

**Acceptance Criteria:**

- [ ] Tests for rendering, pagination, and empty state
- [ ] Tests confirmed to FAIL before implementation

---

### Task 5.4: Activity Log Panel — Implementation

**Status:** 🔴 Blocked by 5.3
**Effort:** 1h
**Dependencies:** Task 5.3
**User Stories:** US4
**FRs:** FR-008

**Description:**
Create activity log component in `src/components/team/activity-log.tsx`. Integrate into team management page. Cursor-based pagination with "Load more" button.

**Acceptance Criteria:**

- [ ] Activity log renders with all fields
- [ ] Pagination works
- [ ] All tests from Task 5.3 pass

---

### Task 5.5: Dashboard Navigation — Add Team Link

**Status:** 🔴 Blocked by 5.2
**Effort:** 0.5h
**Dependencies:** Task 5.2
**User Stories:** US1

**Description:**
Add "Team" navigation link to the employer dashboard sidebar. Link to `/dashboard/team`. Visible to all employer roles.

**Acceptance Criteria:**

- [ ] "Team" link visible in employer dashboard navigation
- [ ] Links to correct page
- [ ] Active state styled correctly

---

## Phase 6: Quality Gates

### Task 6.1: Security Review

**Status:** 🔴 Blocked by 4.2
**Effort:** 1h
**Dependencies:** Task 4.2

**Description:**
Run security review on all new and modified code. Verify:

- Role enforcement at API level (not just UI)
- Last-admin protection cannot be bypassed
- Clerk webhook signature verification covers new events
- No sensitive data in activity logs
- Cross-org access impossible

**Acceptance Criteria:**

- [ ] All CRITICAL and HIGH issues resolved
- [ ] Role enforcement verified for all employer endpoints
- [ ] No sensitive data exposure in activity logs

---

### Task 6.2: Code Review and Cleanup

**Status:** 🔴 Blocked by 5.5, 4.3, 3.2
**Effort:** 1h
**Dependencies:** All implementation tasks

**Description:**
Run code review on all new code. Verify:

- No console.log statements
- No hardcoded values
- Consistent error handling
- Type safety throughout
- 80%+ test coverage

**Acceptance Criteria:**

- [ ] Code review passes with no CRITICAL issues
- [ ] Test coverage ≥ 80%
- [ ] TypeScript compilation clean

---

## Summary

| Phase                  | Tasks        | Effort    |
| ---------------------- | ------------ | --------- |
| 1. Schema & Middleware | 4 tasks      | 5h        |
| 2. Team Router         | 8 tasks      | 12.5h     |
| 3. Webhook Events      | 2 tasks      | 2.5h      |
| 4. Router Audit        | 3 tasks      | 4.5h      |
| 5. UI                  | 5 tasks      | 6h        |
| 6. Quality Gates       | 2 tasks      | 2h        |
| **Total**              | **24 tasks** | **32.5h** |

## Parallelization Opportunities

- Tasks 1.1 and 1.2 are independent (parallel)
- Tasks 2.1 and 1.3 are independent (parallel)
- Tasks 2.3, 2.5, 2.7 can run in parallel (independent test writing)
- Tasks 3.1 and Phase 2 tasks can run in parallel
- Tasks 4.1 can run in parallel with Phase 2 and 3
- Tasks 5.1 and 5.3 can run in parallel

## Critical Path

```
1.1 → 1.3 → 1.4 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8 → 5.1 → 5.2 → 5.5 → 6.2
```

## User Story → Task Mapping

| User Story                 | Tasks                                       |
| -------------------------- | ------------------------------------------- |
| US1: Admin Invites Members | 1.1, 2.3, 2.4, 2.7, 2.8, 3.1, 3.2, 5.1, 5.2 |
| US2: Role Enforcement      | 1.3, 1.4, 4.1, 4.2                          |
| US3: Admin Manages Team    | 2.5, 2.6, 5.1, 5.2                          |
| US4: Activity Log          | 2.1, 2.2, 2.7, 2.8, 4.3, 5.3, 5.4           |
| US5: Backward Compat       | 1.3, 1.4, 5.1, 5.2                          |
