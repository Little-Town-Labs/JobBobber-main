# Feature 8: Private Negotiation Parameters

**Branch:** 8-private-negotiation-parameters
**Priority:** P1
**Status:** Draft
**Created:** 2026-03-06

---

## Overview

Enable job seekers and employers to configure private negotiation parameters that their AI agents use during matching and agent-to-agent conversations. These parameters are never exposed to the other party or through any public API — they are strictly private to the user and their agent.

The database schema for private settings already exists (SeekerSettings, JobSettings). This feature adds the user-facing management UI, the API endpoints for CRUD operations, privacy boundary enforcement, and feature flag gating for Beta rollout.

**Business Value:** Private parameters enable AI agents to negotiate strategically on behalf of users without revealing sensitive information like minimum salary expectations or true budget maximums. This is core to the platform's value proposition of autonomous, privacy-preserving job matching.

---

## User Stories

### US-1: Job Seeker Private Settings Management

**As a** job seeker
**I want** to configure my private negotiation parameters (minimum salary, deal-breakers, priorities, exclusions)
**So that** my AI agent can negotiate on my behalf without revealing my exact requirements

**Acceptance Criteria:**

- [ ] Job seeker can set a minimum salary (integer, optional)
- [ ] Job seeker can define salary flexibility rules (e.g., "flexible for equity", "firm minimum")
- [ ] Job seeker can list deal-breakers (free-text items that disqualify a job)
- [ ] Job seeker can rank priorities (ordered list of what matters most)
- [ ] Job seeker can list industry or company exclusions (companies/industries to avoid)
- [ ] All settings persist across sessions
- [ ] Settings can be updated at any time

**Priority:** High

---

### US-2: Employer Private Job Settings Management

**As an** employer
**I want** to configure private hiring parameters for each job posting (true max salary, training willingness, urgency, priority attributes)
**So that** my AI agent has strategic context for candidate evaluation without exposing our hiring budget

**Acceptance Criteria:**

- [ ] Employer can set a true maximum salary per job posting (may differ from public range)
- [ ] Employer can override minimum qualification requirements (soften hard requirements)
- [ ] Employer can specify skills they're willing to train on (reduces strict skill filtering)
- [ ] Employer can set hiring urgency level (low/medium/high/critical)
- [ ] Employer can define priority attributes (ordered list of what matters most in a candidate)
- [ ] Settings are per-job-posting, not per-employer
- [ ] Settings can be updated while the posting is active

**Priority:** High

---

### US-3: Privacy Boundary Enforcement

**As a** user (either role)
**I want** my private settings to never be visible to other users
**So that** my negotiation position is protected

**Acceptance Criteria:**

- [ ] Private settings are never included in any API response accessible to other users
- [ ] A job seeker cannot see an employer's private job settings
- [ ] An employer cannot see a job seeker's private settings
- [ ] Private settings are only readable by the owning user's API calls
- [ ] Attempting to access another user's private settings returns a not-found or forbidden response (not a data leak)

**Priority:** High

---

### US-4: Feature Flag Gating

**As a** product manager
**I want** private negotiation parameters gated behind a feature flag
**So that** the feature can be rolled out gradually during Beta

**Acceptance Criteria:**

- [ ] When the `PRIVATE_PARAMS` feature flag is OFF, the private settings UI is hidden
- [ ] When the flag is OFF, the API endpoints still exist but return an appropriate error
- [ ] When the flag is ON, users see and can interact with their private settings
- [ ] The flag can be toggled without a deployment

**Priority:** Medium

---

### US-5: Custom Agent Prompt (Preview)

**As a** job seeker or employer
**I want** to optionally provide a custom prompt to influence my agent's behavior
**So that** I can guide my agent's negotiation style

**Acceptance Criteria:**

- [ ] An optional free-text field exists for a custom agent prompt
- [ ] The prompt has a reasonable character limit (max 2000 characters)
- [ ] The prompt is stored alongside other private settings
- [ ] The prompt is not shared with the other party

**Priority:** Low

---

## Functional Requirements

**FR-1:** Job seekers can create, read, update, and delete their private settings via dedicated API endpoints.

**FR-2:** Employers can create, read, update, and delete private job settings for each of their job postings via dedicated API endpoints.

**FR-3:** Private settings API endpoints enforce ownership — only the owning user can access their own settings.

**FR-4:** All private settings endpoints require authentication and role-appropriate authorization.

**FR-5:** The private settings UI is conditionally rendered based on the `PRIVATE_PARAMS` feature flag.

**FR-6:** When the feature flag is OFF, API endpoints return a 403-equivalent response indicating the feature is not available.

**FR-7:** Salary values must be non-negative integers.

**FR-8:** Deal-breakers, priorities, and exclusions are ordered lists of strings (max 20 items each, max 200 characters per item).

**FR-9:** Urgency level must be one of: LOW, MEDIUM, HIGH, CRITICAL.

**FR-10:** Priority attributes (employer side) are ordered lists of strings (max 10 items, max 200 characters per item).

---

## Non-Functional Requirements

**NFR-1 (Security):** Private settings are never logged, never included in error reports, and never returned in any API response except to the owning user.

**NFR-2 (Performance):** Reading private settings responds in < 200ms (p95).

**NFR-3 (Privacy):** Private settings exist in separate database tables from public profiles, ensuring no accidental JOIN leaks.

**NFR-4 (Reliability):** Saving private settings is atomic — partial saves do not occur.

**NFR-5 (Usability):** The private settings form clearly communicates that these values are never shared with employers/seekers.

---

## Edge Cases & Error Handling

- **User has no private settings yet:** The UI shows empty/default state. Reading returns null or empty defaults (not an error).
- **Job posting deleted while settings exist:** Private job settings are cascade-deleted with the posting.
- **Feature flag toggled while user is on settings page:** Page shows a "feature not available" message on next API call; does not crash.
- **Salary set to 0:** Allowed — user may intentionally have no minimum.
- **Salary set to negative number:** Rejected with validation error.
- **More than 20 deal-breakers/priorities/exclusions:** Rejected with validation error.
- **Empty custom prompt:** Allowed — treated as "no custom prompt" (agent uses defaults).
- **Concurrent updates:** Last write wins (standard upsert behavior); no conflict resolution needed at this stage.

---

## Out of Scope

- Agent integration (using private settings during matching) — that is Feature 9/10
- Salary negotiation logic or flexibility rule interpretation
- Privacy audit logging (deferred to Feature 18)
- Encryption of private settings at the application layer (database-level encryption via provider is sufficient for now)

---

## Success Metrics

- Job seekers can configure all private settings fields and see them persisted
- Employers can configure per-posting private settings
- Zero private settings data leaks in any API response to non-owners
- Feature flag correctly gates UI visibility and API access
- 100% test coverage on privacy boundary enforcement
