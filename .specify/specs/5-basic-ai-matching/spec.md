# Feature Specification: Basic AI Matching

**Feature:** 5-basic-ai-matching
**Branch:** 5-basic-ai-matching
**PRD Sections:** 7.1 Agent Types, 7.3 Agent Guardrails, 11 Phase 1 MVP
**Priority:** P0
**Status:** Draft
**Created:** 2026-03-05

---

## Overview

Basic AI Matching is the core value proposition of JobBobber's MVP. When an employer activates a job posting, the system automatically evaluates all eligible job seeker profiles against the posting using an AI agent powered by the employer's own API key (BYOK). The agent generates a numeric match score (0-100) and a human-readable explanation of the match rationale. Results are stored as Match records for both parties to review.

This is one-directional matching only: the Employer Agent evaluates static job seeker profiles. No agent-to-agent conversations, no job seeker agent involvement, and no private negotiation parameters are used in the MVP. Those capabilities are deferred to Features 8-10 (Phase 2).

**Business Value:**

- Proves the core matching loop works end-to-end
- Validates that BYOK-powered AI can produce useful match results
- Gives both parties actionable match data to drive platform engagement
- Establishes the foundation for two-way matching and agent conversations in Phase 2

---

## User Stories

### User Story 1: Employer Activates Matching

**As an** employer
**I want** matching to begin automatically when I activate a job posting
**So that** I receive a ranked list of candidates without manual screening

**Acceptance Criteria:**

- [ ] When a job posting transitions from DRAFT to ACTIVE, a background matching workflow is triggered
- [ ] The workflow evaluates all eligible job seeker profiles (active profiles with at least name and one skill)
- [ ] Matching only runs if the employer has a valid BYOK API key configured
- [ ] If no BYOK key exists, the employer sees a clear message directing them to configure one
- [ ] The employer is notified (in-app) when matching completes

**Priority:** High

---

### User Story 2: Employer Reviews Match Results

**As an** employer
**I want** to see a ranked list of candidates with match scores and reasoning
**So that** I can quickly identify the most promising candidates

**Acceptance Criteria:**

- [ ] Matches are displayed sorted by score (highest first)
- [ ] Each match shows: candidate name, match score (0-100), confidence level (Strong/Good/Potential), and a brief explanation
- [ ] Employer can accept or decline each match
- [ ] Match list is paginated for postings with many matches
- [ ] Only matches above a minimum threshold are shown (score >= 30)

**Priority:** High

---

### User Story 3: Job Seeker Receives Match Notifications

**As a** job seeker
**I want** to be notified when I'm matched with a job opportunity
**So that** I can review the opportunity and decide whether to proceed

**Acceptance Criteria:**

- [ ] Job seeker sees new matches on their dashboard
- [ ] Each match shows: company name, job title, match score, confidence level, and match summary
- [ ] Job seeker can accept or decline each match
- [ ] Match summary explains why the role is a potential fit from the job seeker's perspective
- [ ] No matches below the minimum threshold (score >= 30) are shown to the job seeker

**Priority:** High

---

### User Story 4: Mutual Match Reveals Contact Information

**As an** employer and job seeker who have both accepted a match
**I want** to exchange contact information
**So that** we can proceed to schedule an interview

**Acceptance Criteria:**

- [ ] When both parties accept, the match status changes to "mutual accept"
- [ ] Employer receives the job seeker's contact information and availability
- [ ] Job seeker receives the employer's contact information
- [ ] Contact information is only revealed after mutual acceptance (never before)
- [ ] Both parties see a clear indication that the match is mutual

**Priority:** High

---

### User Story 5: Agent Respects Ethical Guardrails

**As a** platform operator
**I want** the matching agent to respect anti-discrimination guidelines
**So that** matching decisions are fair and legally compliant

**Acceptance Criteria:**

- [ ] Agent evaluation prompt explicitly instructs the model to ignore protected characteristics (race, gender, age, disability, religion, national origin)
- [ ] Match reasoning never references protected characteristics
- [ ] Agent focuses exclusively on skills, experience, qualifications, and role alignment
- [ ] Guardrail instructions are included in the system prompt, not optional
- [ ] Agent output is validated to ensure compliance (no protected characteristic mentions in reasoning)

**Priority:** High

---

### User Story 6: Matching Handles Errors Gracefully

**As an** employer
**I want** the matching process to handle failures without data loss
**So that** partial results are preserved and I'm informed of any issues

**Acceptance Criteria:**

- [ ] If the BYOK API key is invalid or expired, the workflow reports the error and stops
- [ ] If the LLM returns malformed output for a single candidate, that candidate is skipped and the rest continue
- [ ] If the LLM provider is rate-limited, the workflow retries with backoff
- [ ] Partial results are saved incrementally (not all-or-nothing)
- [ ] The employer sees the workflow status (running/completed/failed) on their dashboard
- [ ] Failed evaluations can be retried individually

**Priority:** Medium

---

## Functional Requirements

### FR-1: Matching Trigger

When a job posting transitions from DRAFT to ACTIVE status, the system initiates a background matching workflow. The workflow processes asynchronously and does not block the status transition.

### FR-2: Candidate Discovery

The matching workflow identifies all eligible job seeker profiles. An eligible profile must be:

- Marked as active (`isActive = true`)
- Has a non-empty name
- Has at least one skill listed

### FR-3: BYOK Key Resolution

The matching workflow uses the employer's BYOK API key for all LLM calls. The key is:

- Decrypted from storage at workflow execution time
- Used via the platform's AI SDK integration
- Never logged or exposed in workflow state

If no valid key exists, the workflow terminates with a clear error status.

### FR-4: Agent Evaluation

For each eligible candidate, the Employer Agent:

1. Receives the job posting details (title, description, required skills, preferred skills, experience level, employment type, location type)
2. Receives the candidate profile (name, headline, skills, experience, education, location)
3. Generates a structured evaluation containing:
   - `score`: integer 0-100 representing overall match quality
   - `confidence`: one of "STRONG" (score 70-100), "GOOD" (score 50-69), "POTENTIAL" (score 30-49)
   - `matchSummary`: 2-4 sentence explanation of the match rationale
   - `strengthAreas`: list of areas where the candidate excels for the role
   - `gapAreas`: list of areas where the candidate falls short

### FR-5: Output Validation

All agent output is validated against a strict schema before storage. If validation fails:

- The candidate is skipped
- An error is logged
- The workflow continues with remaining candidates

Invalid LLM responses are never stored.

### FR-6: Match Record Creation

For candidates scoring >= 30, a Match record is created containing:

- Reference to the job posting
- Reference to the job seeker
- Reference to the employer
- Confidence score and level
- Match summary text
- Initial status: PENDING for both seeker and employer

### FR-7: Match Status Management

Each match has independent status for both parties:

- **PENDING**: Initial state, awaiting review
- **ACCEPTED**: Party has accepted the match
- **DECLINED**: Party has declined the match
- **EXPIRED**: Match was not acted on within the expiry period

Status transitions are one-way (PENDING -> ACCEPTED/DECLINED/EXPIRED). No reversal.

### FR-8: Mutual Accept Flow

When both parties have ACCEPTED:

- Job seeker's contact information and availability are revealed to the employer
- Employer contact information is revealed to the job seeker
- Match record is updated to reflect mutual acceptance

### FR-9: Workflow Observability

The matching workflow exposes status to the employer:

- **QUEUED**: Workflow has been triggered, not yet started
- **RUNNING**: Currently evaluating candidates
- **COMPLETED**: All candidates evaluated, matches created
- **FAILED**: Workflow terminated due to error (with error message)

Progress is tracked as `evaluatedCount / totalCount`.

---

## Non-Functional Requirements

### NFR-1: Performance

- Individual candidate evaluation should complete within 10 seconds (LLM response time)
- Full matching workflow for 100 candidates should complete within 20 minutes
- Match list page should load within 500ms (database query, no LLM calls)

### NFR-2: Reliability

- Workflow must be resumable if interrupted (no re-evaluating already-scored candidates)
- Partial results must be persisted incrementally
- Retry logic for transient LLM provider errors (3 retries with exponential backoff)
- Workflow state survives server restarts

### NFR-3: Security

- BYOK key decrypted only at execution time, never persisted in workflow state
- Job seeker private settings (salary, deal-breakers) are NOT accessed in MVP matching
- Contact information only revealed after mutual acceptance
- Agent prompts do not contain or reference private negotiation parameters

### NFR-4: Cost Transparency

- Each matching run logs the number of LLM calls made
- Employer can see how many evaluations were performed per posting
- No hidden API calls beyond the evaluation loop

### NFR-5: Scalability

- Workflow handles up to 500 candidates per posting without timeout
- Concurrent matching workflows for different postings do not interfere
- Rate limiting respects the LLM provider's limits per API key

---

## Edge Cases & Error Handling

### EC-1: No Eligible Candidates

When no job seeker profiles meet the eligibility criteria, the workflow completes with zero matches and the employer sees an "No candidates available yet" message.

### EC-2: BYOK Key Invalid at Execution Time

If the employer's API key is invalid when the workflow starts (e.g., expired or revoked since last validation), the workflow terminates with a FAILED status and a message directing the employer to update their key.

### EC-3: LLM Provider Rate Limiting

If the LLM provider returns a rate limit error, the workflow pauses and retries with exponential backoff (1s, 2s, 4s). After 3 failed retries for a single candidate, that candidate is skipped.

### EC-4: Malformed LLM Response

If the LLM returns output that does not conform to the evaluation schema (missing fields, wrong types, score out of range), the candidate is skipped and the error is logged. The workflow continues.

### EC-5: Employer Deactivates Posting Mid-Workflow

If the posting status changes away from ACTIVE while the workflow is running, the workflow should complete its current evaluation and then stop. Already-created matches remain valid.

### EC-6: Job Seeker Deactivates Profile

If a job seeker deactivates their profile after being matched but before the employer reviews, the match remains visible to the employer but marked as "candidate unavailable."

### EC-7: Duplicate Workflow Trigger

If a posting is deactivated and reactivated, a new matching workflow runs. It does not create duplicate matches for candidates already matched from a previous run.

### EC-8: Match Expiry

Matches that remain in PENDING status for either party beyond a configurable expiry period (default: 14 days) transition to EXPIRED automatically.

---

## Out of Scope (MVP)

The following capabilities are explicitly excluded from this feature and deferred to later phases:

- **Agent-to-agent conversations** (Feature 9)
- **Job seeker agent evaluation** — job seeker's agent does not evaluate the opportunity in MVP (Feature 10)
- **Private negotiation parameters** — salary, deal-breakers are not considered (Feature 8)
- **Vector/semantic search** for initial candidate filtering (Feature 11)
- **Custom agent prompting** (Feature 15)
- **Email notifications** for matches (Feature 6)
- **Aggregate feedback insights** from matching patterns (Feature 14)

---

## Success Metrics

| Metric                   | Target                                            | Measurement                      |
| ------------------------ | ------------------------------------------------- | -------------------------------- |
| Match score accuracy     | >60% of accepted matches have score >= 50         | Track accept rates by score band |
| Workflow completion rate | >95% of workflows complete without failure        | Monitor workflow status          |
| Time to first match      | <10 minutes from posting activation               | Measure workflow duration        |
| Employer engagement      | >50% of employers review their matches within 48h | Track dashboard views            |
| Mutual accept rate       | >20% of matches result in mutual acceptance       | Track match status changes       |

---

## Glossary

| Term             | Definition                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| Employer Agent   | The AI agent that evaluates job seeker profiles on behalf of an employer |
| Match Score      | 0-100 integer representing overall candidate-role alignment              |
| Confidence Level | Categorical bucket: STRONG (70-100), GOOD (50-69), POTENTIAL (30-49)     |
| BYOK             | Bring Your Own Key — employer provides their own LLM API key             |
| Mutual Accept    | Both employer and job seeker have accepted the match                     |
| Workflow         | Asynchronous background process managed by the workflow engine           |
