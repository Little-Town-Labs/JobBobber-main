# Task Breakdown — Feature 6: Match Dashboard

**Branch:** 6-match-dashboard
**Plan:** .specify/specs/6-match-dashboard/plan.md
**Total Tasks:** 16
**Phases:** 6
**Total Effort:** 21 hours

---

## Phase 1: Backend Enhancements

### Task 1.1: Extended Match Router — Tests

**Status:** 🟡 Ready
**Effort:** 2 hours
**Dependencies:** None
**Parallel with:** Task 2.1

**Description:**
Write tests for the enhanced matches router: status filtering, sort param, and status counts procedures. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Tests for `listForSeeker` with `status` filter (PENDING, ACCEPTED, DECLINED, none)
- [ ] Tests for `listForSeeker` with `sort` param (confidence desc, createdAt desc)
- [ ] Tests for `listForPosting` with same filter/sort params
- [ ] Tests for new `getStatusCounts` procedure (seeker)
- [ ] Tests for new `getPostingStatusCounts` procedure (employer)
- [ ] Tests confirmed to FAIL

**User Stories:** US-1, US-2, US-4

---

### Task 1.2: Extended Match Router — Implementation

**Status:** 🔴 Blocked by 1.1
**Effort:** 2 hours
**Dependencies:** Task 1.1

**Description:**
Extend existing `listForSeeker` and `listForPosting` with optional `status` and `sort` params. Add `getStatusCounts` and `getPostingStatusCounts` procedures.

**Acceptance Criteria:**

- [ ] All tests from 1.1 pass
- [ ] `listForSeeker` accepts optional `status` and `sort` params
- [ ] `listForPosting` accepts optional `status` and `sort` params
- [ ] `getStatusCounts` returns {all, pending, accepted, declined} for seeker
- [ ] `getPostingStatusCounts` returns same per posting for employer
- [ ] Existing functionality unchanged (backward compatible)

---

## Phase 2: Email Notifications

### Task 2.1: Notification Inngest Functions — Tests

**Status:** 🟡 Ready
**Effort:** 1.5 hours
**Dependencies:** None
**Parallel with:** Task 1.1

**Description:**
Write tests for the notification Inngest functions. Mock Resend and DB calls. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Tests for `notification/match.created` event handler — sends email to seeker
- [ ] Tests for `notification/mutual.accept` event handler — sends email to both parties
- [ ] Tests that notification respects opt-out preferences
- [ ] Tests that email failure does not throw (logs and retries)
- [ ] Tests confirmed to FAIL

**User Stories:** US-7

---

### Task 2.2: Notification Inngest Functions — Implementation

**Status:** 🔴 Blocked by 2.1
**Effort:** 2.5 hours
**Dependencies:** Task 2.1

**Description:**
Add Resend dependency. Create Inngest functions for `notification/match.created` and `notification/mutual.accept`. Create email templates. Register in Inngest function index.

**Acceptance Criteria:**

- [ ] All tests from 2.1 pass
- [ ] Resend client configured with env var `RESEND_API_KEY`
- [ ] Email templates: match-created (to seeker), mutual-accept (to seeker + employer)
- [ ] Inngest functions registered in `functions/index.ts`
- [ ] Emails include link to dashboard

---

### Task 2.3: Event Firing from Mutations

**Status:** 🔴 Blocked by 1.2
**Effort:** 1 hour
**Dependencies:** Task 1.2

**Description:**
Fire Inngest notification events from `matches.updateStatus` (on mutual accept) and from `evaluate-candidates` workflow (on match creation).

**Acceptance Criteria:**

- [ ] `notification/match.created` fired when new Match record created in evaluate-candidates
- [ ] `notification/mutual.accept` fired when updateStatus achieves mutual accept
- [ ] Events include all required data fields per contract
- [ ] Existing tests updated to verify event firing

---

## Phase 3: Notification Preferences

### Task 3.1: Notification Preferences — Tests

**Status:** 🟡 Ready
**Effort:** 0.5 hours
**Dependencies:** None
**Parallel with:** Task 1.1, Task 2.1

**Description:**
Write tests for notification preferences CRUD. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Tests for `getNotifPrefs` returns defaults when none set
- [ ] Tests for `updateNotifPrefs` updates and returns new prefs
- [ ] Tests for seeker and employer roles
- [ ] Tests confirmed to FAIL

**User Stories:** US-7 (opt-out)

---

### Task 3.2: Notification Preferences — Implementation

**Status:** 🔴 Blocked by 3.1
**Effort:** 1.5 hours
**Dependencies:** Task 3.1

**Description:**
Add `notifPrefs` column to Employer model (Prisma migration). Implement `getNotifPrefs` and `updateNotifPrefs` procedures reading from SeekerSettings.notifPrefs or Employer.notifPrefs.

**Acceptance Criteria:**

- [ ] All tests from 3.1 pass
- [ ] Prisma migration adds `notifPrefs Json @default("{}")` to Employer model
- [ ] `getNotifPrefs` returns parsed preferences with defaults
- [ ] `updateNotifPrefs` validates and persists

---

## Phase 4: Frontend Dashboard

### Task 4.1: Dashboard Components — Tests

**Status:** 🔴 Blocked by 1.2
**Effort:** 2 hours
**Dependencies:** Task 1.2

**Description:**
Write component tests for enhanced dashboard UI. **TESTS FIRST** (TDD).

**Acceptance Criteria:**

- [ ] Tests for MatchFilterTabs — renders tabs with counts, calls onFilter
- [ ] Tests for MatchSortDropdown — renders options, calls onSort
- [ ] Tests for DeclineConfirmDialog — shows on decline, confirms/cancels
- [ ] Tests for NotificationPrefsToggle — renders toggles, calls onChange
- [ ] Tests for enhanced seeker dashboard layout
- [ ] Tests confirmed to FAIL

**User Stories:** US-1, US-2, US-3, US-5, US-6

---

### Task 4.2: Dashboard Components — Implementation

**Status:** 🔴 Blocked by 4.1
**Effort:** 2.5 hours
**Dependencies:** Task 4.1

**Description:**
Implement new components: MatchFilterTabs, MatchSortDropdown, DeclineConfirmDialog, NotificationPrefsToggle.

**Acceptance Criteria:**

- [ ] All tests from 4.1 pass
- [ ] MatchFilterTabs shows All/Pending/Accepted/Declined with count badges
- [ ] MatchSortDropdown toggles between "Best Match" and "Newest"
- [ ] DeclineConfirmDialog appears before decline action, cancel returns to pending
- [ ] NotificationPrefsToggle shows match-created and mutual-accept toggles

---

### Task 4.3: Dashboard Pages — Implementation

**Status:** 🔴 Blocked by 4.2, 2.2, 3.2
**Effort:** 1.5 hours
**Dependencies:** Tasks 4.2, 2.2, 3.2

**Description:**
Enhance the existing seeker and employer match pages with filter tabs, sort controls, decline confirmation, and notification settings link. Mobile-responsive layout.

**Acceptance Criteria:**

- [ ] Seeker matches page: filter tabs + sort + pagination + decline dialog
- [ ] Employer matches page: posting selector + filter tabs + sort + pagination
- [ ] Notification preferences accessible from dashboard (link or inline)
- [ ] Mobile-responsive layout (min 375px, NFR-2)
- [ ] Keyboard-navigable interactive elements (NFR-3)

---

## Phase 5: Testing & Hardening

### Task 5.1: Integration Tests

**Status:** 🔴 Blocked by 4.3
**Effort:** 2 hours
**Dependencies:** Task 4.3

**Description:**
Integration tests against NeonDB for extended match router procedures, notification preferences, and event firing.

**Acceptance Criteria:**

- [ ] Filter by status returns correct subsets
- [ ] Sort by confidence vs newest returns correct order
- [ ] Status counts query returns accurate numbers
- [ ] Notification prefs persist and read correctly
- [ ] All tests pass against real database

---

### Task 5.2: E2E Tests

**Status:** 🔴 Blocked by 5.1
**Effort:** 1.5 hours
**Dependencies:** Task 5.1

**Description:**
Playwright E2E tests for dashboard user flows.

**Acceptance Criteria:**

- [ ] Seeker: view matches, filter by status, sort, accept, decline with confirmation
- [ ] Employer: select posting, view matches, filter, sort, accept, decline
- [ ] Mutual accept: contact info revealed in UI
- [ ] Notification preferences: toggle and save

---

### Task 5.3: Code Review

**Status:** 🔴 Blocked by 5.1
**Effort:** 0.5 hours
**Dependencies:** Task 5.1
**Parallel with:** Task 5.2

**Description:**
Run code review on all Feature 6 changes.

**Acceptance Criteria:**

- [ ] No CRITICAL or HIGH issues
- [ ] Code follows existing patterns
- [ ] No unnecessary complexity

---

## Phase 6: Security Review

### Task 6.1: Security Review

**Status:** 🔴 Blocked by 5.1
**Effort:** 1 hour
**Dependencies:** Task 5.1
**Parallel with:** Task 5.2, Task 5.3

**Description:**
Security review of contact info handling, notification content, and preference access.

**Acceptance Criteria:**

- [ ] Contact info never in API responses pre-mutual-accept (NFR-4)
- [ ] Email content does not expose sensitive match details
- [ ] Notification prefs only accessible by owner
- [ ] Resend API key not exposed to client
- [ ] No new OWASP vulnerabilities introduced

---

## Dependency Graph

```
Phase 1 (Backend):    1.1 → 1.2 → 2.3
Phase 2 (Email):      2.1 → 2.2 ──────┐
Phase 3 (Prefs):      3.1 → 3.2 ──────┤
Phase 4 (Frontend):   1.2 → 4.1 → 4.2 → 4.3 (also needs 2.2, 3.2)
Phase 5 (Testing):    4.3 → 5.1 → 5.2
Phase 6 (Security):   5.1 → 6.1

Parallel opportunities:
- 1.1 ∥ 2.1 ∥ 3.1 (all independent, can start simultaneously)
- 5.2 ∥ 5.3 ∥ 6.1 (all depend on 5.1, can run in parallel)
```

## Critical Path

```
1.1 → 1.2 → 4.1 → 4.2 → 4.3 → 5.1 → 5.2
```

**Duration:** ~14 hours on critical path

## Quality Gates

- [x] TDD enforced (tests before implementation for every phase)
- [ ] Security review at Phase 6
- [ ] Code review at Task 5.3
- [ ] E2E tests validate all user stories
- [ ] Performance: dashboard loads < 1s (NFR-1)
