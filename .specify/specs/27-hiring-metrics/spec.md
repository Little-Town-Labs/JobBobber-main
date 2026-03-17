# Feature 27: Hiring Metrics

**Branch:** 27-hiring-metrics
**PRD Section:** Section 6.5 Employer Dashboard (Advanced Analytics)
**Priority:** P2
**Complexity:** Small
**Status:** Planned
**Dependencies:** None (builds on existing dashboard and match data)

---

## Overview

Employers need visibility into how efficiently their hiring pipeline is performing.
This feature adds time-based hiring metrics to the employer dashboard, tracking the
duration from posting creation through first match to mutual acceptance. Metrics are
displayed as per-posting breakdowns and aggregate trends over configurable time
windows, with CSV export for offline analysis.

**Business Value:** Enables employers to identify bottlenecks in their hiring
pipeline, compare posting performance, and make data-driven decisions about their
recruitment strategy.

---

## User Stories

### User Story 1: View Per-Posting Metrics

**As an** employer
**I want** to see time-to-first-match and time-to-mutual-accept for each of my job postings
**So that** I can identify which postings attract candidates quickly and which are stalling

**Acceptance Criteria:**

- [ ] Each active or closed posting displays time-to-first-match (days/hours from posting creation to first match)
- [ ] Each posting displays time-to-mutual-accept (days/hours from posting creation to first mutual acceptance)
- [ ] Postings with no matches yet display "No matches yet" instead of a metric
- [ ] Postings with matches but no mutual accepts display the match metric with "No mutual accepts yet" for the second metric
- [ ] Metrics update in real-time as new matches and acceptances occur

**Priority:** High

### User Story 2: View Aggregate Dashboard Metrics

**As an** employer
**I want** to see averaged hiring metrics across all my postings
**So that** I can understand my overall hiring efficiency

**Acceptance Criteria:**

- [ ] Dashboard displays average time-to-first-match across all postings
- [ ] Dashboard displays average time-to-mutual-accept across all postings
- [ ] Dashboard displays total number of postings, matches, and mutual accepts
- [ ] Averages exclude postings with zero matches (to avoid skewing)
- [ ] Metrics are clearly labeled with units (days or hours)

**Priority:** High

### User Story 3: View Trend Analysis

**As an** employer
**I want** to see how my hiring metrics trend over 30, 60, and 90 day windows
**So that** I can track whether my hiring process is improving over time

**Acceptance Criteria:**

- [ ] User can select between 30-day, 60-day, and 90-day time windows
- [ ] Trend data shows average time-to-first-match per window
- [ ] Trend data shows average time-to-mutual-accept per window
- [ ] Trend data shows total match volume per window
- [ ] Visual indicator shows whether the current window is better or worse than the previous equivalent window

**Priority:** Medium

### User Story 4: Export Metrics Data

**As an** employer
**I want** to export my hiring metrics as a CSV file
**So that** I can analyze the data in a spreadsheet or share it with my team

**Acceptance Criteria:**

- [ ] Export button generates a CSV file with one row per posting
- [ ] CSV includes: posting title, status, created date, first match date, first mutual accept date, time-to-first-match (hours), time-to-mutual-accept (hours), total matches, total accepts
- [ ] CSV file name includes the employer name and export date
- [ ] Export respects the currently selected time window filter
- [ ] Empty postings (no matches) are included in export with empty metric columns

**Priority:** Medium

### User Story 5: Posting Performance Comparison

**As an** employer
**I want** to see my postings ranked by hiring speed
**So that** I can identify what makes certain postings more effective

**Acceptance Criteria:**

- [ ] Postings can be sorted by time-to-first-match (ascending/descending)
- [ ] Postings can be sorted by time-to-mutual-accept (ascending/descending)
- [ ] Postings can be sorted by total match count
- [ ] Visual highlighting indicates postings performing above or below average

**Priority:** Low

---

## Functional Requirements

### FR-1: Time-to-First-Match Calculation

The system shall calculate time-to-first-match as the duration between `jobPosting.createdAt` and the `createdAt` of the earliest `Match` record for that posting.

### FR-2: Time-to-Mutual-Accept Calculation

The system shall calculate time-to-mutual-accept as the duration between `jobPosting.createdAt` and the `updatedAt` timestamp of the first `Match` where both `seekerStatus` and `employerStatus` are `ACCEPTED`.

### FR-3: Aggregate Metrics

The system shall compute averages across all postings owned by the employer, excluding postings that have zero matches from the average calculation.

### FR-4: Time Window Filtering

The system shall support filtering metrics by 30-day, 60-day, and 90-day windows, where the window is measured backward from the current date and filters on `jobPosting.createdAt`.

### FR-5: Trend Comparison

The system shall compare the current window's averages against the previous equivalent window (e.g., current 30 days vs. prior 30 days) and indicate improvement or decline.

### FR-6: CSV Export

The system shall generate a downloadable CSV file containing per-posting metrics for the selected time window.

### FR-7: Access Control

Only authenticated employer members shall access hiring metrics. Metrics are scoped to the employer's own postings — no cross-employer data visible.

---

## Non-Functional Requirements

### NFR-1: Performance

- Metrics queries shall respond within 500ms for employers with up to 100 postings
- CSV export shall complete within 2 seconds for up to 500 postings

### NFR-2: Accuracy

- All time calculations shall use UTC timestamps consistently
- Metrics shall reflect current data (no caching stale results beyond 60 seconds)

### NFR-3: Usability

- Metric values shall display in human-readable units (e.g., "3 days 4 hours" not "76 hours")
- Dashboard layout shall be responsive for tablet and desktop viewports

### NFR-4: Security

- Metrics endpoint must enforce employer authentication and organization scoping
- No personally identifiable information about job seekers shall appear in metrics or exports

---

## Edge Cases & Error Handling

### EC-1: New Employer with No Postings

Display an empty state message: "Create your first job posting to start tracking hiring metrics."

### EC-2: Postings with No Matches

Include in the posting list but display "No matches yet" for time metrics. Exclude from averages.

### EC-3: Matches with No Mutual Accept

Display time-to-first-match but show "Pending" for time-to-mutual-accept.

### EC-4: All Matches Declined

Display time-to-first-match. Time-to-mutual-accept shows "No mutual accepts."

### EC-5: Single Posting Skews Average

When only one posting has metrics, display the value but label it as "Based on 1 posting" to set expectations.

### EC-6: Time Window with No Data

If the selected time window contains no postings, display "No postings created in this period."

### EC-7: Very Fast Matches (< 1 hour)

Display in hours and minutes (e.g., "2 hours 15 minutes") rather than "0 days."

---

## Success Metrics

- Employers with 5+ postings view the metrics page at least once per week
- CSV export is used by at least 20% of employers with 10+ postings
- Average page load time for metrics dashboard < 500ms

---

## UI Placement

Metrics shall be accessible via a dedicated sub-page at `/dashboard/metrics` with a navigation link in the employer dashboard sidebar. This keeps the main dashboard focused on daily workflow while giving metrics room for charts, tables, and export controls.

---

## Feature Flag

This feature shall be gated behind a `HIRING_METRICS` feature flag. When disabled, the metrics navigation link and sub-page are hidden from the employer dashboard.
