# Feature 14: Aggregate Feedback Insights

**Branch:** 14-aggregate-feedback-insights
**Phase:** 3 (Full Launch)
**Priority:** P1
**Dependencies:** Features 9 (agent-to-agent conversations), 10 (two-way matching)
**Status:** Draft

---

## Overview

Private, AI-generated feedback that helps users improve their job search or hiring outcomes. Job seekers see what makes them attractive to employers, what patterns cause rejections, and how their profile is trending over time. Employers see what makes their postings attractive, what causes candidates to decline, and how their hiring funnel performs.

Insights are derived from **aggregated** conversation outcomes — never from individual conversations or specific counterparties. This is a transparency and self-improvement tool, not a surveillance tool.

### Business Value

- Increases user engagement by providing actionable self-improvement guidance
- Reduces churn by giving users a reason to return to the dashboard
- Differentiates JobBobber from platforms that offer no feedback on rejected applications
- Creates a positive feedback loop: better profiles lead to better matches

---

## User Stories

### User Story 1: Job Seeker Views Profile Insights

**As a** job seeker
**I want** to see AI-generated insights about my profile strengths and areas for improvement
**So that** I can improve my profile and increase my match rate

**Acceptance Criteria:**

- [ ] Insights dashboard section displays strengths, weaknesses, and recommendations
- [ ] Insights are generated only after a minimum number of completed conversations (threshold: 3)
- [ ] No individual conversation details or employer identities are revealed
- [ ] Trend direction (improving/stable/declining) is displayed with the current match rate
- [ ] Insights update automatically after new conversations complete

**Priority:** High

### User Story 2: Employer Views Posting Insights

**As an** employer
**I want** to see AI-generated insights about my job posting's effectiveness
**So that** I can improve my postings and attract better candidates

**Acceptance Criteria:**

- [ ] Insights dashboard section displays strengths, weaknesses, and recommendations for each posting
- [ ] Aggregate metrics shown: total conversations, match rate, interview conversion rate
- [ ] No individual candidate identities or private negotiation details revealed
- [ ] Insights generated only after minimum conversation threshold (3)
- [ ] Trend direction displayed comparing recent performance to historical

**Priority:** High

### User Story 3: Insights Regeneration

**As a** user (job seeker or employer)
**I want** my insights to stay current as new conversations complete
**So that** I always see relevant, up-to-date feedback

**Acceptance Criteria:**

- [ ] Insights regenerated automatically after a configurable number of new completed conversations (default: 3)
- [ ] Regeneration runs as a background workflow (not blocking user actions)
- [ ] Previous insights are replaced, not appended (single current snapshot)
- [ ] Regeneration timestamp displayed so users know when insights were last updated
- [ ] Manual refresh option available (rate-limited to once per hour)

**Priority:** Medium

### User Story 4: Privacy-Safe Aggregation

**As a** user
**I want** to be confident that insights never reveal individual conversation details
**So that** I can trust the platform with my private negotiation data

**Acceptance Criteria:**

- [ ] Insights generation uses only aggregate statistics and patterns, not raw conversation text
- [ ] No specific salary figures, deal-breakers, or private parameters appear in insights
- [ ] No counterparty names, company names, or identifying details appear in insights
- [ ] Insights for users who opted out of data usage are still generated (opt-out applies to model training, not self-service insights)
- [ ] Minimum conversation threshold prevents de-anonymization through small sample sizes

**Priority:** High

### User Story 5: Empty State and Insufficient Data

**As a** new user with few or no completed conversations
**I want** to see a helpful message instead of empty insights
**So that** I understand what insights are and when they will become available

**Acceptance Criteria:**

- [ ] Users with zero completed conversations see an explanatory empty state
- [ ] Users below the minimum threshold see a progress indicator (e.g., "2 of 3 conversations needed")
- [ ] Empty state includes guidance on how to trigger more conversations
- [ ] No misleading or fabricated insights shown when data is insufficient

**Priority:** Medium

---

## Functional Requirements

### FR-1: Insight Generation Engine

The system generates insights by analyzing aggregated conversation outcomes for a user. Inputs include: conversation count, match/no-match ratio, confidence score distribution, match acceptance rates, and conversation outcome patterns. The AI produces structured output containing strengths (what works), weaknesses (what doesn't), and actionable recommendations.

### FR-2: Minimum Conversation Threshold

Insights are only generated when a user has at least 3 completed conversations (configurable). Below this threshold, the system displays an informative empty state with progress toward the threshold.

### FR-3: Trend Calculation

The system calculates a trend direction (IMPROVING, STABLE, DECLINING) by comparing the user's recent conversation outcomes (last 5) against their overall historical performance. The trend is displayed alongside the current match rate.

### FR-4: Scheduled Regeneration

Insights are regenerated via a background workflow triggered after N new completed conversations (default: 3). The workflow is idempotent — running it multiple times for the same data produces the same result.

### FR-5: Manual Refresh

Users can manually trigger insight regeneration, rate-limited to once per hour. The refresh runs asynchronously and the UI updates when complete.

### FR-6: Privacy Boundary Enforcement

The insight generation prompt receives only aggregate statistics and anonymized pattern data — never raw conversation messages, counterparty identities, or private negotiation parameters. This is enforced at the data-gathering layer, not just the prompt.

### FR-7: Structured Output Validation

All AI-generated insight content is validated against a strict schema before storage. Malformed or invalid AI output is rejected and logged, not stored.

### FR-8: Feature Flag Gating

The entire feature is gated behind a `FEEDBACK_INSIGHTS` feature flag. When disabled, all API endpoints return appropriate error responses and UI sections are hidden.

### FR-9: Insight Content Structure

Each insight record contains:

- Strengths: list of positive attributes (max 5 items, max 200 chars each)
- Weaknesses: list of areas for improvement (max 5 items, max 200 chars each)
- Recommendations: list of actionable suggestions (max 5 items, max 300 chars each)
- Metrics: total conversations, in-progress count, match rate, interview conversion rate
- Trend: direction (improving/stable/declining)
- Generated timestamp

---

## Non-Functional Requirements

### NFR-1: Performance

- Insight generation should complete within 30 seconds (background workflow, not blocking UI)
- Dashboard insight display should load within 500ms (cached data, no on-demand generation)
- Manual refresh should acknowledge the request within 200ms (async processing)

### NFR-2: Security

- Insight data accessible only to the owning user (enforced at API level)
- No cross-user insight data leakage
- AI prompts must not include raw private parameters or conversation text
- BYOK key used for AI generation (user's own key)

### NFR-3: Reliability

- Failed insight generation should not affect other system operations
- Partial failures (e.g., AI timeout) should be retried automatically (up to 3 times)
- Stale insights (>30 days old) should be visually indicated in the UI

### NFR-4: Privacy

- Minimum 3 conversations required before any insights generated
- No individual conversation details derivable from insight content
- Insights for opted-out users still generated (opt-out covers model training, not personal insights)

---

## Edge Cases & Error Handling

### EC-1: User Has Only No-Match Conversations

Insights should still be generated with appropriate framing (e.g., "Based on your conversations so far, here are areas where alignment was challenging"). The system should not produce discouraging or blaming language.

### EC-2: User's BYOK Key Is Invalid or Expired

Insight generation fails gracefully. The user sees their last valid insights (if any) with a notice that regeneration requires a valid API key. No crash or data loss.

### EC-3: AI Returns Malformed Output

Output validation rejects the response. The system retries up to 3 times. If all retries fail, the existing insights remain unchanged and an internal error is logged.

### EC-4: Concurrent Regeneration Requests

If a regeneration is already in progress, additional requests (manual or scheduled) are deduplicated. The user sees a "generation in progress" indicator.

### EC-5: User Deletes Account Mid-Generation

Insight generation checks for user existence before writing results. If the user no longer exists, the workflow terminates cleanly.

### EC-6: Very High Conversation Volume

For users with hundreds of conversations, the aggregation query should be bounded (e.g., last 50 conversations) to maintain performance. Older data contributes to lifetime metrics but not to pattern analysis.

### EC-7: Single Posting Employer

Employers with only one job posting receive insights at the posting level. No misleading "cross-posting comparison" data is generated.

---

## Success Metrics

- **Adoption:** >50% of eligible users (those above threshold) view their insights within 7 days of generation
- **Engagement:** Users who view insights return to the platform 30% more frequently
- **Quality:** <5% of users report insights as unhelpful or inaccurate via feedback mechanism
- **Privacy:** Zero incidents of individual conversation detail leakage in insights

---

## Out of Scope

- Real-time insight updates during active conversations
- Comparison with other users ("you rank in the top 10%")
- Insights shared between job seekers and employers
- Historical insight versioning (only current snapshot stored)
- Insight export (PDF/CSV)
