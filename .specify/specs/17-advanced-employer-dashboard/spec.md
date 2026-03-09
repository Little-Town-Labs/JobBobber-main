# Feature 17: Advanced Employer Dashboard

**Branch:** `17-advanced-employer-dashboard`
**Status:** Draft
**Priority:** P2
**Phase:** 3 (Full Launch)
**Feature Flag:** `ADVANCED_EMPLOYER_DASHBOARD` (defaults OFF)

---

## Overview

The current employer dashboard provides basic job posting management and match viewing on a per-posting basis. This feature enhances the employer experience with a unified pipeline view across all postings, a candidate comparison tool, bulk operations, per-posting metrics, advanced filtering, and a team activity view for multi-member accounts.

**Business Value:** Employers managing multiple postings and reviewing many candidates need efficient tools to make hiring decisions quickly. Pipeline visibility, side-by-side candidate comparison, and bulk actions reduce time-to-hire and improve the employer experience — increasing retention and upgrade potential.

**Dependencies:** Feature 6 (Match Dashboard), Feature 13 (Multi-Member Employer Accounts)

---

## User Stories

### User Story 1: Pipeline Overview

**As an** employer
**I want** a single view showing all my active job postings with match counts and status breakdowns
**So that** I can quickly assess hiring progress across all roles without navigating into each posting individually

**Acceptance Criteria:**

- [ ] Dashboard displays all active job postings in a summary table/grid
- [ ] Each posting shows: title, status, total matches, pending/accepted/declined counts, and match rate percentage
- [ ] Postings are sortable by title, status, match count, or match rate
- [ ] Clicking a posting navigates to its detailed matches view
- [ ] Empty state displayed when no active postings exist

**Priority:** High

---

### User Story 2: Candidate Comparison

**As an** employer
**I want** to view 2–4 matched candidates side-by-side for a specific job posting
**So that** I can compare their qualifications, match scores, and agent evaluation summaries to make informed decisions

**Acceptance Criteria:**

- [ ] Employer can select 2–4 candidates from a posting's match list for comparison
- [ ] Side-by-side view displays: candidate name/identifier, confidence score, match summary, key skills, experience level, and agent evaluation highlights
- [ ] Comparison view clearly highlights differences between candidates (e.g., confidence score ranking)
- [ ] Employer can accept or decline candidates directly from the comparison view
- [ ] Comparison selection persists during the session (not lost on page navigation within the posting)

**Priority:** High

---

### User Story 3: Bulk Operations

**As an** employer
**I want** to perform batch actions on multiple candidates at once
**So that** I can efficiently manage large volumes of matches without repetitive individual actions

**Acceptance Criteria:**

- [ ] Employer can select multiple matches via checkboxes
- [ ] "Select All" checkbox available to select all visible matches
- [ ] Batch accept: sets selected candidates' employer status to ACCEPTED
- [ ] Batch decline: sets selected candidates' employer status to DECLINED
- [ ] CSV export: downloads selected (or all) matched candidates as a CSV file with key fields (name, score, status, posting title, date)
- [ ] Confirmation dialog shown before bulk status changes
- [ ] Counts update immediately after bulk operations

**Priority:** Medium

---

### User Story 4: Job Posting Metrics

**As an** employer
**I want** to see performance metrics for each job posting
**So that** I can understand which postings are attracting quality candidates and adjust my hiring strategy

**Acceptance Criteria:**

- [ ] Each posting displays: total conversations initiated, in-progress conversations, completed evaluations, match rate (matches / total evaluations as percentage)
- [ ] Metrics displayed both on the pipeline overview and on the individual posting detail page
- [ ] Metrics update in near-real-time as new conversations complete
- [ ] Zero-state metrics shown for newly created postings (all zeros, not blank)

**Priority:** Medium

---

### User Story 5: Advanced Filtering

**As an** employer
**I want** to filter matched candidates by multiple criteria simultaneously
**So that** I can quickly find the most relevant candidates for my needs

**Acceptance Criteria:**

- [ ] Filter by match status: pending, accepted, declined, or all
- [ ] Filter by experience level: entry, mid, senior, executive
- [ ] Filter by location type: remote, hybrid, onsite
- [ ] Filter by confidence level: Strong, Good, Potential (categorical match confidence tiers)
- [ ] Multiple filters can be combined (AND logic)
- [ ] Active filter count displayed; one-click "Clear filters" to reset all
- [ ] Filtered results update without full page reload

**Priority:** Medium

---

### User Story 6: Team Activity View

**As an** employer admin
**I want** to see a log of team member actions related to hiring
**So that** I can track who reviewed, accepted, or declined candidates and maintain accountability

**Acceptance Criteria:**

- [ ] Activity log shows team member actions: match accept/decline, posting create/edit/status change
- [ ] Each entry shows: team member name, action type, target entity (posting/candidate), and timestamp
- [ ] Activity log visible only to users with Admin role
- [ ] Activity log is paginated (most recent first)
- [ ] Activity log can be filtered by team member or action type

**Priority:** Low

---

## Functional Requirements

### FR-1: Pipeline Aggregation

The system shall aggregate match statistics across all job postings owned by the employer, providing summary counts (total, pending, accepted, declined) and match rate for each posting.

### FR-2: Candidate Comparison Engine

The system shall allow employers to select 2–4 candidates from a single posting's match list and display them in a side-by-side comparison layout with their match details.

### FR-3: Bulk Status Updates

The system shall support batch accept and batch decline operations on multiple matches simultaneously within a single posting's match list.

### FR-4: CSV Export

The system shall generate and download a CSV file containing matched candidate data (identifier, confidence score, match status, posting title, match date) for selected or all matches within a posting.

### FR-5: Posting Metrics Aggregation

The system shall compute and display per-posting metrics: total conversations, in-progress conversations, completed evaluations, and match rate percentage.

### FR-6: Multi-Criteria Filtering

The system shall support filtering matches by status, experience level, location type, and confidence level, with filters combinable using AND logic.

### FR-7: Team Activity Logging

The system shall record and display employer team member actions (match status changes, posting modifications) in a paginated, filterable activity log visible to admins.

### FR-8: Feature Flag Gating

All advanced employer dashboard features shall be gated behind the `ADVANCED_EMPLOYER_DASHBOARD` feature flag, defaulting to OFF.

---

## Non-Functional Requirements

### NFR-1: Performance

- Pipeline overview loads within 1 second for employers with up to 50 active postings
- Candidate comparison renders within 500ms for 4 candidates
- Bulk operations complete within 2 seconds for up to 100 selected matches
- CSV export generates within 3 seconds for up to 1,000 matches

### NFR-2: Security

- All data access restricted to the employer's own postings and matches
- Bulk operations require authenticated employer session
- CSV export does not include private negotiation parameters or raw salary data
- Team activity log restricted to Admin role members only

### NFR-3: Usability

- Responsive layout supporting desktop (1024px+) and tablet (768px+) viewports
- Keyboard-accessible selection controls (checkboxes, comparison picks)
- Loading states shown during data fetches and bulk operations
- Error states with retry options for failed operations

### NFR-4: Reliability

- Bulk operations are atomic — either all selected matches update or none do
- CSV export handles large datasets without browser memory issues (streaming approach for 1000+ rows)
- Feature gracefully degrades when feature flag is OFF (existing dashboard renders normally)

---

## Edge Cases & Error Handling

### EC-1: No Active Postings

When the employer has no active postings, the pipeline view shows an empty state with a prompt to create a posting.

### EC-2: Posting With No Matches

Postings that have not yet generated any matches display zero-state metrics (0 conversations, 0 matches, 0% match rate) rather than blank or error states.

### EC-3: Comparison Selection Limits

If the employer attempts to select more than 4 candidates for comparison, the system shows a validation message and prevents the 5th selection. If fewer than 2 are selected, the comparison view shows a prompt to select at least one more.

### EC-4: Bulk Operation on Already-Updated Matches

If some selected matches have already been accepted/declined (e.g., by another team member), the bulk operation skips those and reports how many were actually updated vs. skipped.

### EC-5: CSV Export With No Data

If no matches exist (after filtering), the CSV export button is disabled with a tooltip explaining no data is available.

### EC-6: Team Activity for Single-Member Employers

Employers without multi-member accounts do not see the team activity section. The activity log section only renders when the `MULTI_MEMBER_EMPLOYER` feature flag is also enabled and the employer has team members.

### EC-7: Concurrent Bulk Operations

If the employer triggers a second bulk operation while the first is still processing, the system queues the second request or shows a "please wait" indicator.

### EC-8: Large Match Count Per Posting

For postings with 500+ matches, the pipeline overview still loads quickly by using server-side aggregation (counts computed at the database level, not by fetching all matches).

---

## Success Metrics

- **Pipeline adoption:** >70% of employers with 2+ postings use the pipeline view within 30 days of enablement
- **Comparison usage:** >40% of employers use the comparison tool at least once per posting
- **Bulk action adoption:** >50% of employers with 10+ pending matches use bulk operations
- **Time-to-decision:** Median time from match creation to employer accept/decline decreases by 25%

---

## Out of Scope

- Real-time collaborative editing (multiple team members editing the same posting simultaneously)
- Custom dashboard layouts or widget reordering
- Automated bulk actions based on rules (e.g., "auto-decline all below 40 confidence")
- Integration with external ATS (Applicant Tracking Systems)
- Mobile-specific native features (responsive web is sufficient)
